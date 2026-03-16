import React, { useState, useRef, useEffect } from 'react';
import { IS_BACKEND_CONNECTED, sendChatMessage } from '../apiService.js';

// ─── Typing indicator ─────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="message-row ai-row">
      <div className="msg-avatar ai-avatar">
        <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
          <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="4" fill="#00e5ff" />
        </svg>
      </div>
      <div className="msg-bubble ai-bubble typing-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Offline banner shown inside the chat area ────────────────
function OfflineBanner() {
  return (
    <div className="chat-offline-banner">
      <div className="offline-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.5">
          <path d="M9.172 16.172a4 4 0 0 1 5.656 0" />
          <path d="M6.343 13.343a8 8 0 0 1 11.314 0" />
          <path d="M3.515 10.515C5.901 8.13 9.05 7 12 7s6.099 1.13 8.485 3.515" />
          <line x1="2" y1="2" x2="22" y2="22" stroke="#ff6b6b" strokeWidth="1.8" />
        </svg>
      </div>
      <div className="offline-text">
        <span className="offline-title">Backend not connected</span>
        <span className="offline-desc">
          AI responses require a live server. Open{' '}
          <code className="inline-code">src/apiService.js</code> and set{' '}
          <code className="inline-code">BACKEND_URL</code> to your endpoint to enable chat.
        </span>
      </div>
      <span className="offline-badge">Offline</span>
    </div>
  );
}

// ─── Main ChatBox ─────────────────────────────────────────────
function ChatBox({ agent }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'ai',
      text: IS_BACKEND_CONNECTED
        ? `Hello! I'm your ${agent} AI assistant. Upload company documents above, then ask me anything about your organization.`
        : `Hi! I'm the ${agent} agent. I'm in offline mode right now — once the backend is connected, I'll be able to answer your questions.`,
      time: new Date(),
      isSystem: !IS_BACKEND_CONNECTED,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const conversationIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !IS_BACKEND_CONNECTED) return;

    setError(null);
    const userMsg = { id: Date.now(), role: 'user', text, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // ── Replace with your real API call via api.js ──
      const data = await sendChatMessage(agent, text, conversationIdRef.current);

      if (data.conversation_id) {
        conversationIdRef.current = data.conversation_id;
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', text: data.reply, time: new Date() },
      ]);
    } catch (err) {
      setError('Could not reach the backend. Check your server and try again.');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isDisabled = !IS_BACKEND_CONNECTED || isTyping;

  return (
    <div className="chatbox">
      {/* Offline notice */}
      {!IS_BACKEND_CONNECTED && <OfflineBanner />}

      {/* Messages */}
      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${msg.role === 'user' ? 'user-row' : 'ai-row'}`}
          >
            {msg.role === 'ai' && (
              <div className="msg-avatar ai-avatar">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
                  <circle cx="16" cy="16" r="4" fill="#00e5ff" />
                </svg>
              </div>
            )}

            <div
              className={`msg-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'} ${
                msg.isSystem ? 'system-bubble' : ''
              }`}
            >
              <p className="msg-text">{msg.text}</p>
              <span className="msg-time">{formatTime(msg.time)}</span>
            </div>

            {msg.role === 'user' && (
              <div className="msg-avatar user-avatar">{agent.charAt(0)}</div>
            )}
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Error toast */}
      {error && (
        <div className="chat-error-toast">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button className="toast-dismiss" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Input Bar */}
      <div className={`chat-input-bar ${isDisabled ? 'input-bar-disabled' : ''}`}>
        {!IS_BACKEND_CONNECTED && (
          <div className="input-lock-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>
              Chat locked — set <code className="inline-code">BACKEND_URL</code> in{' '}
              <code className="inline-code">src/apiService.js</code> to unlock
            </span>
          </div>
        )}
        <div className={`chat-input-wrap ${isDisabled ? 'wrap-disabled' : ''}`}>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              IS_BACKEND_CONNECTED
                ? `Ask ${agent} anything about your company...`
                : 'Chat unavailable — backend not connected'
            }
            rows={1}
            disabled={isDisabled}
          />
          <div className="chat-input-actions">
            {IS_BACKEND_CONNECTED && <span className="input-hint">↵ Send</span>}
            <button
              className={`send-btn ${input.trim() && IS_BACKEND_CONNECTED ? 'active' : ''}`}
              onClick={sendMessage}
              disabled={isDisabled || !input.trim()}
              title={IS_BACKEND_CONNECTED ? 'Send message' : 'Backend not connected'}
            >
              {IS_BACKEND_CONNECTED ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;