# Setup Guide – AI Multi-Agent RAG System

This guide explains how to set up and run the **Google Drive based RAG (Retrieval Augmented Generation) system** locally.

The system automatically:
- Reads documents from a Google Drive folder
- Converts them into embeddings
- Stores them in Pinecone
- Uses Groq LLM to answer questions based on the stored data.

---

# 1. Prerequisites

Make sure you have installed:

- Python **3.10+**
- Git
- VS Code (recommended)

Check Python version:

```bash
python --version
```

---

# 2. Clone the Repository

```bash
git clone https://github.com/karen-elisha/ai-multi-agent-rag.git
cd ai-multi-agent-rag
```

---

# 3. Create Virtual Environment

Create a virtual environment:

```bash
python -m venv env
```

Activate it:

Mac/Linux:

```bash
source env/bin/activate
```

Windows:

```bash
env\Scripts\activate
```

---

# 4. Install Dependencies

Install required packages:

```bash
pip install -r requirements.txt
```

---

# 5. Setup Environment Variables

Create a file called `.env` in the project root.

Example:

```
PINECONE_API_KEY=your_pinecone_key
GROQ_API_KEY=your_groq_key
FOLDER_ID=your_google_drive_folder_id
```

---

# 6. Setup Google Drive API

1. Go to **Google Cloud Console**
2. Create a new project
3. Enable **Google Drive API**

Then create OAuth credentials:

```
APIs & Services → Credentials → Create Credentials → OAuth Client ID
```

Choose:

```
Application type: Desktop App
```

Download the file and rename it:

```
credentials.json
```

Place it in the project root:

```
ai-multi-agent-rag/
    credentials.json
```

---

# 7. Add Yourself as a Test User

Go to:

```
APIs & Services → OAuth consent screen
```

Add your email under:

```
Test users
```

---

# 8. Create Pinecone Index

Open:

https://app.pinecone.io

Create index:

```
Name: employee-rag
Dimension: 384
Metric: cosine
```

---

# 9. Run the Project

Run the program:

```bash
python src/rag_agent.py
```

The first time you run it:

1. A browser window will open
2. Login to Google
3. Allow Drive access

A file called `token.json` will be created automatically.

---

# 10. Add Documents to Google Drive

Upload supported files to your Drive folder.

Supported formats:

- PDF
- CSV
- DOCX

Example:

```
employees.csv
policies.pdf
handbook.docx
```

The system will automatically detect **new files** and add them to Pinecone.

---

# 11. Ask Questions

After indexing documents, the assistant starts:

```
Assistant ready!
```

Example query:

```
You: What is the leave policy?
Assistant: Employees are entitled to 20 days of annual leave.
```

---

# 12. Project Architecture

```
Google Drive
     ↓
Document Extraction
     ↓
SentenceTransformer Embeddings
     ↓
Pinecone Vector Database
     ↓
Retriever
     ↓
Groq LLM
     ↓
Answer
```

---

# 13. Files Generated Automatically

During execution, the following files are created:

```
token.json
processed_files.json
```

These track authentication and processed documents.

---

# 14. Troubleshooting

### Google Access Blocked

Add your email to **OAuth Test Users** in Google Cloud.

### Pinecone API Key Error

Check `.env` file.

### Credentials Not Found

Ensure `credentials.json` is in the project root.

---

# 15. Future Improvements

Possible upgrades:

- Real-time Drive monitoring
- Multi-agent architecture
- Streaming responses
- Hybrid search (keyword + vector)
- LangGraph agent routing
