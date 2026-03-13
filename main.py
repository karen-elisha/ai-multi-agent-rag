import os
import io
import pandas as pd
from pypdf import PdfReader
from docx import Document
from pinecone import Pinecone
from groq import Groq
from sentence_transformers import SentenceTransformer
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from dotenv import load_dotenv

# Load keys from .env file
load_dotenv()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
FOLDER_ID = os.getenv("FOLDER_ID")

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Connect
pc = Pinecone(api_key=PINECONE_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
index = pc.Index("employee-rag")
model = SentenceTransformer("all-MiniLM-L6-v2")

# ─────────────────────────────────────────
# GOOGLE DRIVE
# ─────────────────────────────────────────
def get_drive_service():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return build("drive", "v3", credentials=creds)

def download_file(service, file_id, filename):
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buf.seek(0)
    return buf

def extract_text(buf, filename):
    texts = []
    if filename.endswith(".csv"):
        df = pd.read_csv(buf)
        for _, row in df.iterrows():
            text = " | ".join([f"{col}: {val}" for col, val in row.items()])
            texts.append(text)
    elif filename.endswith(".pdf"):
        reader = PdfReader(buf)
        for page in reader.pages:
            text = page.extract_text()
            if text and text.strip():
                texts.append(text)
    elif filename.endswith(".docx"):
        doc = Document(buf)
        for para in doc.paragraphs:
            if para.text.strip():
                texts.append(para.text)
    return texts

def load_files_from_drive():
    print("🔗 Connecting to Google Drive...")
    service = get_drive_service()
    results = service.files().list(
        q=f"'{FOLDER_ID}' in parents",
        fields="files(id, name, mimeType)"
    ).execute()
    files = results.get("files", [])
    print(f"📁 Found {len(files)} files in Drive folder")
    all_texts = []
    for file in files:
        filename = file["name"]
        file_id = file["id"]
        print(f"  Reading {filename}...")
        try:
            buf = download_file(service, file_id, filename)
            texts = extract_text(buf, filename)
            all_texts.extend(texts)
            print(f"  ✅ Extracted {len(texts)} chunks from {filename}")
        except Exception as e:
            print(f"  ❌ Could not read {filename}: {e}")
    print(f"\n✅ Total chunks extracted: {len(all_texts)}")
    return all_texts

# ─────────────────────────────────────────
# PINECONE
# ─────────────────────────────────────────
def store_in_pinecone(texts):
    print("\n📤 Uploading to Pinecone...")
    texts = [t for t in texts if len(t.strip()) >= 10]
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        embeddings = model.encode(batch_texts).tolist()
        vectors = [{
            "id": f"chunk_{i+j}",
            "values": embeddings[j],
            "metadata": {"text": batch_texts[j]}
        } for j in range(len(batch_texts))]
        index.upsert(vectors=vectors)
        print(f"  Uploaded {min(i+batch_size, len(texts))}/{len(texts)} chunks...")
    print("✅ All data stored in Pinecone!")

# ─────────────────────────────────────────
# ASK QUESTIONS
# ─────────────────────────────────────────
def ask_question(question):
    question_embedding = model.encode(question).tolist()
    results = index.query(
        vector=question_embedding,
        top_k=5,
        include_metadata=True
    )
    context = "\n".join([r["metadata"]["text"] for r in results["matches"]])
    prompt = f"""You are a helpful assistant that answers questions based only on the provided data.
If the answer isn't in the data, say so.

Based on this data:
{context}

Answer this: {question}"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────

# Uncomment ONLY when you have new files to upload
# texts = load_files_from_drive()
# store_in_pinecone(texts)

print("\n🤖 Assistant ready! Ask anything about your data (type 'quit' to exit)\n")
while True:
    question = input("You: ")
    if question.lower() == "quit":
        break
    answer = ask_question(question)
    print(f"\nAssistant: {answer}\n")
