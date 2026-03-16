import React, { useState, useEffect, useRef } from 'react';

const CREDENTIALS = { interviewer: '1234', manager: '1234' };

/* ── Canvas Particle System ──────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const particles = [];
    const connections = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.hue = Math.random() > 0.7 ? 280 : 185;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 80; i++) particles.push(new Particle());

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = (1 - dist / 120) * 0.12;
            ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="particle-canvas" />;
}

/* ── Glitch Text ────────────────────────────────────── */
function GlitchText({ text }) {
  return (
    <span className="glitch-wrap" data-text={text}>
      {text}
      <span className="glitch-layer glitch-1" aria-hidden="true">{text}</span>
      <span className="glitch-layer glitch-2" aria-hidden="true">{text}</span>
    </span>
  );
}

/* ── Magnetic Button ────────────────────────────────── */
function MagneticButton({ children, className, onClick, disabled, type }) {
  const btnRef = useRef(null);
  const handleMouseMove = (e) => {
    if (disabled) return;
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.25;
    const dy = (e.clientY - cy) * 0.25;
    btn.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
  };
  const handleMouseLeave = () => {
    if (btnRef.current) btnRef.current.style.transform = '';
  };
  return (
    <button
      ref={btnRef}
      type={type || 'button'}
      className={className}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}

/* ── Ripple on click ────────────────────────────────── */
function useRipple(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [ref]);
}

/* ── Scan line overlay ──────────────────────────────── */
function ScanLines() {
  return <div className="scanlines" aria-hidden="true" />;
}

/* ── Typing cursor text ─────────────────────────────── */
function TypewriterText({ phrases }) {
  const [display, setDisplay] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIdx];
    let timeout;
    if (!deleting && charIdx < current.length) {
      timeout = setTimeout(() => setCharIdx(i => i + 1), 60);
    } else if (!deleting && charIdx === current.length) {
      timeout = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx(i => i - 1), 30);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setPhraseIdx(i => (i + 1) % phrases.length);
    }
    setDisplay(current.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases]);

  return (
    <span className="typewriter">
      {display}<span className="type-cursor">|</span>
    </span>
  );
}

/* ── Main Login ─────────────────────────────────────── */
export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  useRipple(cardRef);

  /* Holographic tilt effect */
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / rect.height) * 14;
    const ry = -((e.clientX - cx) / rect.width) * 14;
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02,1.02,1.02)`;
    const gx = ((e.clientX - rect.left) / rect.width) * 100;
    const gy = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--holo-x', `${gx}%`);
    card.style.setProperty('--holo-y', `${gy}%`);
    setMousePos({ x: gx, y: gy });
  };
  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.setProperty('--holo-x', '50%');
      cardRef.current.style.setProperty('--holo-y', '50%');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      if (CREDENTIALS[username] && CREDENTIALS[username] === password) {
        onLogin(username);
      } else {
        setError('Access denied. Invalid credentials.');
        setIsLoading(false);
      }
    }, 1100);
  };

  return (
    <div className="login-bg">
      <ParticleCanvas />
      <ScanLines />

      {/* Animated grid */}
      <div className="login-grid" />

      {/* Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Floating corner decorations */}
      <div className="corner-deco corner-tl" />
      <div className="corner-deco corner-br" />

      <div className="login-center">
        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo-hex">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke="#00e5ff" strokeWidth="1.5" />
              <polygon points="16,7 25,12 25,20 16,25 7,20 7,12" fill="#00e5ff" opacity="0.12" />
              <circle cx="16" cy="16" r="4" fill="#00e5ff" />
            </svg>
          </div>
          <span className="login-logo-text">COMPANY AI</span>
        </div>

        {/* Typewriter tagline */}
        <p className="login-typewriter-line">
          <TypewriterText phrases={[
            'Intelligent. Secure. Always on.',
            'Your company brain, supercharged.',
            'Ask anything. Know everything.',
            'Enterprise AI, refined.',
          ]} />
        </p>

        {/* Holographic card */}
        <div
          className="login-card holo-card"
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Holo sheen */}
          <div className="holo-sheen" />
          {/* Top glow line */}
          <div className="card-top-line" />

          <div className="login-card-inner">
            <div className="login-header">
              <h1 className="login-title"><GlitchText text="Welcome back" /></h1>
              <p className="login-subtitle">Sign in to your intelligence hub</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              {/* Username */}
              <div className={`login-field ${focused === 'u' ? 'focused' : ''}`}>
                <label className="login-label">
                  <span className="label-num">01</span> Username
                </label>
                <div className="login-input-wrap">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    type="text"
                    className="login-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onFocus={() => setFocused('u')}
                    onBlur={() => setFocused(null)}
                    placeholder="interviewer or manager"
                    autoComplete="username"
                  />
                  <div className="input-glow-line" />
                </div>
              </div>

              {/* Password */}
              <div className={`login-field ${focused === 'p' ? 'focused' : ''}`}>
                <label className="login-label">
                  <span className="label-num">02</span> Password
                </label>
                <div className="login-input-wrap">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type="password"
                    className="login-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('p')}
                    onBlur={() => setFocused(null)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <div className="input-glow-line" />
                </div>
              </div>

              {error && (
                <div className="login-error">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <MagneticButton
                type="submit"
                className={`login-btn ${isLoading ? 'loading' : ''}`}
                disabled={isLoading || !username || !password}
              >
                <span className="btn-bg-sweep" />
                {isLoading ? (
                  <span className="login-btn-loading">
                    <span className="spinner" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="login-btn-text">
                    Access Dashboard
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </MagneticButton>
            </form>

            <div className="login-footer">
              <span className="login-hint">interviewer / 1234 &nbsp;·&nbsp; manager / 1234</span>
            </div>
          </div>
        </div>

        <p className="login-tagline">
          <span className="tagline-dot" />
          End-to-end encrypted &nbsp;·&nbsp; Zero data retention
        </p>
      </div>
    </div>
  );
}