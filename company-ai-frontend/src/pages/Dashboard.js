import React, { useState, useEffect, useRef } from 'react';
import ChatBox from '../components/ChatBox';
import UploadBox from '../components/UploadBox';
import { IS_BACKEND_CONNECTED, fetchChatHistory } from '../apiService';

const AGENTS = ['interviewer', 'manager'];

/* ── Animated counter ──────────────────────────────── */
function Counter({ target, duration = 1800, suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <span>{val.toLocaleString()}{suffix}</span>;
}

/* ── Floating background orbs for dashboard ───────── */
function DashboardOrbs() {
  return (
    <div className="dash-orbs" aria-hidden="true">
      <div className="dash-orb dash-orb-1" />
      <div className="dash-orb dash-orb-2" />
      <div className="dash-orb dash-orb-3" />
    </div>
  );
}

/* ── Animated grid lines ───────────────────────────── */
function DashboardGrid() {
  return <div className="dash-grid" aria-hidden="true" />;
}

/* ── Live stat card ────────────────────────────────── */
function StatCard({ icon, label, value, suffix, color, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`stat-card stat-card--${color} ${visible ? 'stat-card--visible' : ''}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <span className="stat-card-value">
          {visible ? <Counter target={value} suffix={suffix} /> : '0'}
        </span>
        <span className="stat-card-label">{label}</span>
      </div>
      <div className="stat-card-glow" />
    </div>
  );
}

/* ── History skeleton ──────────────────────────────── */
function HistorySkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="history-skeleton" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="skel-icon" />
          <div className="skel-lines">
            <div className="skel-line skel-title" />
            <div className="skel-line skel-preview" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ── History locked ────────────────────────────────── */
function HistoryLocked() {
  return (
    <div className="history-locked">
      <div className="history-locked-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p className="history-locked-title">History unavailable</p>
      <p className="history-locked-desc">Connect your backend to load past conversations.</p>
      <div className="history-locked-code">
        <code>src/apiService.js → BACKEND_URL</code>
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */
function Dashboard({ agent, onLogout }) {
  const [activeConversation, setActiveConversation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [time, setTime] = useState(new Date());

  const agentLabel = agent.charAt(0).toUpperCase() + agent.slice(1);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Stagger stat cards appearance
  useEffect(() => {
    const t = setTimeout(() => setStatsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Fetch history
  useEffect(() => {
    if (!IS_BACKEND_CONNECTED) return;
    setHistoryLoading(true);
    fetchChatHistory(agent)
      .then(d => setHistory(d.conversations || []))
      .catch(() => setHistoryError('Could not load history.'))
      .finally(() => setHistoryLoading(false));
  }, [agent]);

  const formatTime = (d) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`dashboard-root ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <DashboardOrbs />
      <DashboardGrid />

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className="sidebar">
        {/* Animated scan line on sidebar */}
        <div className="sidebar-scan" />

        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-hex">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="4" fill="#00e5ff" />
              </svg>
            </div>
            {!sidebarCollapsed && <span className="brand-name">Company AI</span>}
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Agent section */}
            <div className="sidebar-section">
              <span className="sidebar-section-label">Active Agent</span>
              <div className="agent-list">
                {AGENTS.map((a, i) => (
                  <div
                    key={a}
                    className={`agent-item ${agent === a ? 'active' : ''}`}
                    style={{ animationDelay: `${0.05 + i * 0.08}s` }}
                  >
                    <div className={`agent-avatar ${agent === a ? 'active' : ''}`}>
                      {a.charAt(0).toUpperCase()}
                    </div>
                    <div className="agent-info">
                      <span className="agent-name">{a.charAt(0).toUpperCase() + a.slice(1)}</span>
                      <span className="agent-role">{a === 'manager' ? 'Full Access' : 'Read Access'}</span>
                    </div>
                    {agent === a && <div className="agent-active-dot" />}
                  </div>
                ))}
              </div>
            </div>

            {/* History section */}
            <div className="sidebar-section flex-grow">
              <div className="history-header-row">
                <span className="sidebar-section-label">Recent Conversations</span>
                <span className={`backend-pill ${IS_BACKEND_CONNECTED ? 'pill-online' : 'pill-offline'}`}>
                  <span className="pill-dot" />
                  {IS_BACKEND_CONNECTED ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className="history-list">
                {!IS_BACKEND_CONNECTED && <HistoryLocked />}
                {IS_BACKEND_CONNECTED && historyLoading && <HistorySkeleton />}
                {IS_BACKEND_CONNECTED && !historyLoading && historyError && (
                  <div className="history-error">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {historyError}
                  </div>
                )}
                {IS_BACKEND_CONNECTED && !historyLoading && !historyError && history.length === 0 && (
                  <div className="history-empty">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>No conversations yet</span>
                  </div>
                )}
                {IS_BACKEND_CONNECTED && !historyLoading && !historyError && history.map((item, i) => (
                  <button
                    key={item.id}
                    className={`history-item ${activeConversation === item.id ? 'active' : ''}`}
                    onClick={() => setActiveConversation(item.id)}
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="history-icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="history-content">
                      <span className="history-title">{item.title}</span>
                      <span className="history-preview">{item.preview}</span>
                    </div>
                    <span className="history-time">{item.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User footer */}
            <div className="sidebar-user">
              <div className="user-avatar-sm">{agentLabel.charAt(0)}</div>
              <div className="user-info">
                <span className="user-name">{agentLabel}</span>
                <span className="user-status">● Online</span>
              </div>
              <button className="logout-btn" onClick={onLogout} title="Sign out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <main className="main-content">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-badge">
              <span className="topbar-badge-dot" />
              {agentLabel} Agent
            </div>
            <h1 className="topbar-title">Intelligence Dashboard</h1>
          </div>
          <div className="topbar-right">
            {/* Live clock */}
            <div className="topbar-clock">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTime(time)}
            </div>
            <div className="topbar-stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              GPT-4o
            </div>
            <div className={`topbar-stat ${IS_BACKEND_CONNECTED ? 'stat-online' : 'stat-offline'}`}>
              <span className={`topbar-status-dot ${IS_BACKEND_CONNECTED ? 'dot-online' : 'dot-offline'}`} />
              {IS_BACKEND_CONNECTED ? 'Connected' : 'Offline'}
            </div>
          </div>
        </header>

        {/* ── STAT STRIP ── */}
        <div className="stat-strip">
          <StatCard
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
            label="Total Sessions" value={1284} color="cyan" delay={500}
          />
          <StatCard
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
            label="Docs Indexed" value={47} color="purple" delay={650}
          />
          <StatCard
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
            label="Avg Response ms" value={320} suffix="ms" color="green" delay={800}
          />
          <StatCard
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            label="Active Users" value={12} color="pink" delay={950}
          />
        </div>

        {/* Content grid */}
        <div className="content-grid">
          <section className="upload-panel">
            <div className="panel-header">
              <div className="panel-icon upload-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <h2 className="panel-title">Knowledge Base</h2>
                <p className="panel-subtitle">Upload company documents to train the AI</p>
              </div>
            </div>
            <UploadBox />
          </section>

          <section className="chat-panel">
            <div className="panel-header">
              <div className="panel-icon chat-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="panel-title">Ask {agentLabel}</h2>
                <p className="panel-subtitle">
                  {IS_BACKEND_CONNECTED
                    ? 'Chat with your company intelligence agent'
                    : 'Connect backend to enable AI responses'}
                </p>
              </div>
            </div>
            <ChatBox agent={agentLabel} />
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;