"""
Flask REST API for the Employee RAG Karen backend.
Exposes /chat, /upload, /history, and /health endpoints.
Connected to the company-ai-frontend React app on http://localhost:3000.
"""
import io
import sys
import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Bootstrap — make parent (ai-multi-agent-rag/src) importable
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from rag_agent import (
    ask_question,
    upload_file_to_drive,
    sync_new_files_from_drive,
    store_in_pinecone,
    extract_text,
    load_uploaded_record,
    save_uploaded_record
)

# ---------------------------------------------------------------------------
# Flask setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    """Quick health-check so the frontend can confirm the server is up."""
    return jsonify({"status": "ok", "service": "employee-rag-karen"}), 200


@app.route("/chat", methods=["POST"])
def chat():
    """
    Expects JSON body: { "message": "...", "agent": "manager" | "interviewer" }
    Returns:          { "reply": "..." }
    """
    data = request.get_json(force=True)
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        agent_type = data.get("agent") or "interview_specialist"
        session_id = data.get("session_id") or "default"
        
        reply = ask_question(message, agent_type=agent_type, session_id=session_id)
        return jsonify({"reply": reply})
    except Exception as exc:
        log.exception("Error in /chat")
        return jsonify({"error": str(exc)}), 500


@app.route("/upload", methods=["POST"])
def upload():
    """
    Accepts a multipart file under the field name 'document'.
    Uploads it to Google Drive, then immediately syncs & indexes into Pinecone.
    Returns: { "filename": "...", "drive_file_id": "...", "chunks": N, "status": "indexed" }
    """
    if "document" not in request.files:
        return jsonify({"error": "No file provided under field 'document'"}), 400

    file = request.files["document"]
    filename = file.filename or "upload"

    # Validate extension
    allowed = {".pdf", ".csv", ".docx"}
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed:
        return jsonify({"error": f"Unsupported file type '{ext}'. Allowed: pdf, csv, docx"}), 400

    file_bytes = file.read()

    try:
        # 1. Push to Google Drive
        log.info("Uploading '%s' to Google Drive...", filename)
        drive_file_id = upload_file_to_drive(file_bytes, filename)
        log.info("Drive upload done — file ID: %s", drive_file_id)

        # 2. Extract text directly from the in-memory bytes
        buf = io.BytesIO(file_bytes)
        texts = extract_text(buf, filename, mime_type=file.mimetype)
        log.info("Extracted %d chunks from '%s'", len(texts), filename)

        if texts:
            # 3. Upsert only this file's chunks into Pinecone
            #    (sync_new_files_from_drive will skip it next time since we record the ID)
            uploaded_ids = load_uploaded_record()
            uploaded_ids.add(drive_file_id)
            store_in_pinecone(texts, uploaded_ids, filename=filename)
        else:
            log.warning("No text extracted from '%s' — only Drive upload done.", filename)

        return jsonify({
            "filename": filename,
            "drive_file_id": drive_file_id,
            "chunks": len(texts),
            "status": "indexed" if texts else "uploaded_no_text",
        })

    except Exception as exc:
        log.exception("Error in /upload")
        return jsonify({"error": str(exc)}), 500


@app.route("/history", methods=["GET"])
def history():
    """
    Stub endpoint — returns an empty conversation list.
    Can be extended later to persist conversations in a DB.
    """
    return jsonify({"conversations": []})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Sync any new Drive files before starting the server
    log.info("🔄 Syncing Google Drive → Pinecone...")
    try:
        new_texts, updated_ids = sync_new_files_from_drive()
        if new_texts:
            store_in_pinecone(new_texts, updated_ids)
            log.info("✅ %d new chunks indexed.", len(new_texts))
        else:
            log.info("✅ Pinecone already up to date.")
    except Exception as exc:
        log.warning("Drive sync failed at startup: %s", exc)

    log.info("🚀 Starting Flask server on http://localhost:8000 ...")
    app.run(host="0.0.0.0", port=8000, debug=False)
