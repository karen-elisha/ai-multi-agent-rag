import React, { useState } from 'react';
import './App.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const [agent, setAgent] = useState(null);
  // 'login' | 'transitioning' | 'dashboard'
  const [screen, setScreen] = useState('login');

  const handleLogin = (agentName) => {
    // Start cinematic transition
    setScreen('transitioning');
    setAgent(agentName);

    // After flash/wipe animation, swap to dashboard
    setTimeout(() => {
      setScreen('dashboard');
    }, 900);
  };

  const handleLogout = () => {
    setScreen('transitioning');
    setTimeout(() => {
      setAgent(null);
      setScreen('login');
    }, 600);
  };

  return (
    <div className="app-root">
      {/* Full-screen transition overlay */}
      {screen === 'transitioning' && (
        <div className="page-transition-overlay">
          <div className="transition-ripple" />
          <div className="transition-scanline" />
          <div className="transition-logo">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <polygon
                points="16,2 30,9 30,23 16,30 2,23 2,9"
                fill="none"
                stroke="#00e5ff"
                strokeWidth="1.5"
                strokeDasharray="80"
                strokeDashoffset="0"
              />
              <circle cx="16" cy="16" r="5" fill="#00e5ff" />
            </svg>
          </div>
        </div>
      )}

      {screen === 'login' && (
        <div className="page-enter-login">
          <Login onLogin={handleLogin} />
        </div>
      )}

      {screen === 'dashboard' && (
        <div className="page-enter-dashboard">
          <Dashboard agent={agent} onLogout={handleLogout} />
        </div>
      )}
    </div>
  );
}

export default App;