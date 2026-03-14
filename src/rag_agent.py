import os
import io
import json
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
UPLOADED_FILES_RECORD = "uploaded_files.json"  # Local tracker file

# Connect
pc = Pinecone(api_key=PINECONE_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
index = pc.Index("employee-rag")
model = SentenceTransformer("all-MiniLM-L6-v2")

# ─────────────────────────────────────────
# UPLOAD TRACKER
# ─────────────────────────────────────────
def load_uploaded_record():
    """Load the set of already-uploaded file IDs from local JSON."""
    if os.path.exists(UPLOADED_FILES_RECORD):
        with open(UPLOADED_FILES_RECORD, "r") as f:
            return set(json.load(f))
    return set()

def save_uploaded_record(uploaded_ids: set):
    """Persist the updated set of uploaded file IDs."""
    with open(UPLOADED_FILES_RECORD, "w") as f:
        json.dump(list(uploaded_ids), f)

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
            flow = InstalledAppFlow.from_client_secrets_file("../credentials.json", SCOPES)
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

def sync_new_files_from_drive():
    """
    Checks Google Drive for files not yet uploaded to Pinecone.
    Returns extracted text chunks only from new files.
    """
    print("🔗 Connecting to Google Drive...")
    service = get_drive_service()

    results = service.files().list(
        q=f"'{FOLDER_ID}' in parents",
        fields="files(id, name, mimeType)"
    ).execute()
    all_drive_files = results.get("files", [])
    print(f"📁 Found {len(all_drive_files)} total files in Drive folder")

    uploaded_ids = load_uploaded_record()
    new_files = [f for f in all_drive_files if f["id"] not in uploaded_ids]

    if not new_files:
        print("✅ No new files to upload. Pinecone is already up to date.")
        return [], uploaded_ids

    print(f"🆕 {len(new_files)} new file(s) detected — processing...")
    all_texts = []
    newly_uploaded_ids = set()

    for file in new_files:
        filename = file["name"]
        file_id = file["id"]
        print(f"  Reading {filename}...")
        try:
            buf = download_file(service, file_id, filename)
            texts = extract_text(buf, filename)
            if texts:
                all_texts.extend(texts)
                newly_uploaded_ids.add(file_id)
                print(f"  ✅ Extracted {len(texts)} chunks from {filename}")
            else:
                print(f"  ⚠️  No text extracted from {filename} — skipping")
        except Exception as e:
            print(f"  ❌ Could not read {filename}: {e}")

    updated_ids = uploaded_ids | newly_uploaded_ids
    return all_texts, updated_ids

# ─────────────────────────────────────────
# PINECONE
# ─────────────────────────────────────────
def store_in_pinecone(texts, updated_ids):
    print("\n📤 Uploading to Pinecone...")
    texts = [t for t in texts if len(t.strip()) >= 10]

    # Use current index stats to offset new chunk IDs and avoid overwriting old ones
    stats = index.describe_index_stats()
    existing_count = stats.get("total_vector_count", 0)

    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        embeddings = model.encode(batch_texts).tolist()
        vectors = [{
            "id": f"chunk_{existing_count + i + j}",
            "values": embeddings[j],
            "metadata": {"text": batch_texts[j]}
        } for j in range(len(batch_texts))]
        index.upsert(vectors=vectors)
        print(f"  Uploaded {min(i + batch_size, len(texts))}/{len(texts)} chunks...")

    save_uploaded_record(updated_ids)  # Persist only after successful upload
    print("✅ All new data stored in Pinecone!")

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
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
new_texts, updated_ids = sync_new_files_from_drive()

if new_texts:
    store_in_pinecone(new_texts, updated_ids)
else:
    print("⏭️  Skipping Pinecone upload — nothing new to store.")

print("\n🤖 Assistant ready! Ask anything about your data (type 'quit' to exit)\n")
while True:
    question = input("You: ")
    if question.lower() == "quit":
        break
    answer = ask_question(question)
    print(f"\nAssistant: {answer}\n")