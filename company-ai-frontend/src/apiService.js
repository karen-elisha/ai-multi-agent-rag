// ─────────────────────────────────────────────────────────────
//  BACKEND CONFIGURATION
//  Set BACKEND_URL to your server endpoint when ready.
//  Leave it as null (or empty string) to run in offline mode.
// ─────────────────────────────────────────────────────────────

export const BACKEND_URL = 'http://127.0.0.1:8000';
// export const BACKEND_URL = null;   // ← set to null to run in offline mode

export const IS_BACKEND_CONNECTED = Boolean(BACKEND_URL);


// ─── Chat API ────────────────────────────────────────────────
// POST /chat  →  { message, agent }
// Expected response: { reply: "..." }
export async function sendChatMessage(agent, message, conversationId = null) {
  if (!IS_BACKEND_CONNECTED) {
    throw new Error('BACKEND_NOT_CONNECTED');
  }
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, message, conversation_id: conversationId }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json(); // { reply: string, conversation_id?: string }
}

// ─── Chat History API ─────────────────────────────────────────
// GET /history?agent=manager
// Expected response: { conversations: [{ id, title, preview, time }] }
export async function fetchChatHistory(agent) {
  if (!IS_BACKEND_CONNECTED) {
    throw new Error('BACKEND_NOT_CONNECTED');
  }
  const res = await fetch(`${BACKEND_URL}/history?agent=${agent}`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json(); // { conversations: [...] }
}

// ─── Upload API ───────────────────────────────────────────────
// POST /upload  →  FormData with file field "document"
// Expected response: { filename, size, status: "indexed" }
export async function uploadDocument(file, agent) {
  if (!IS_BACKEND_CONNECTED) {
    throw new Error('BACKEND_NOT_CONNECTED');
  }
  const formData = new FormData();
  formData.append('document', file);
  formData.append('agent', agent);
  const res = await fetch(`${BACKEND_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json(); // { filename, size, status }
}