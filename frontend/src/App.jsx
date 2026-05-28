import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ── Design Tokens ──────────────────────────────────────────────────────
const C = {
  bg: "#07090F", bg1: "#0C1018", bg2: "#111620", bg3: "#182030",
  border: "#1C2740", border2: "#243050",
  acc: "#5B8DEF", teal: "#00C9A7", amber: "#F5A623",
  red: "#FF4D6D", green: "#22C55E", purple: "#A78BFA",
  white: "#F0F4FF", text: "#B8C4DE", dim: "#5A6A8A",
};

// ── Base Styles ────────────────────────────────────────────────────────
const styles = {
  app: { background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: C.text, fontSize: 14, position: 'relative', overflowX: 'hidden' },
  nav: { background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: "13px 28px", display: "flex", alignItems: "center", justifyBetween: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)" },
  brand: { fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 16, color: C.white, cursor: 'pointer' },
  card: { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },
  input: { width: "100%", background: C.bg3, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "9px 13px", color: C.white, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  label: { display: "block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: C.dim, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5 },
  btnBlue: { background: C.acc, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: 'all 0.2s' },
  btnGhost: { background: "transparent", color: C.dim, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: 'all 0.2s' },
  btnTeal: { background: C.teal, color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: 'all 0.2s' },
  mono: { fontFamily: "'IBM Plex Mono', monospace" },
  display: { fontFamily: "'Bricolage Grotesque', sans-serif" },
};

export default function App() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [loginMode, setLoginMode] = useState(null); // null | 'email'
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [verifyId, setVerifyId] = useState("");
  const [stats, setStats] = useState([
    { label: "Credentials", value: "3 active", color: C.teal },
    { label: "Verifications", value: "8,903", color: C.acc },
    { label: "Institutions", value: "34", color: C.purple },
    { label: "Network", value: "Polygon Amoy", color: C.amber },
  ]);

  // Load active credential count dynamically if possible
  useEffect(() => {
    fetch(`${API_URL}/api/teams`)
      .then(res => res.json())
      .then(data => {
        // Just dummy stats matching seeded DB data + fallback
        setStats([
          { label: "Credentials", value: "4 active", color: C.teal },
          { label: "Verifications", value: "9,102", color: C.acc },
          { label: "Institutions", value: "3", color: C.purple },
          { label: "Network", value: "Polygon Amoy", color: C.amber },
        ]);
      })
      .catch(() => {});
  }, []);

  const handleWalletLogin = async () => {
    setLoading(true);
    setErr('');
    try {
      let activeAddress = address;

      // 1. Connect wallet if not already connected
      if (!isConnected) {
        const connResult = await connectAsync({ connector: injected() });
        activeAddress = connResult.accounts[0];
      }

      // 2. Request message signing for authentication proof
      const message = "Login to ProofPass Portal";
      const signature = await signMessageAsync({ message });

      // 3. Post to backend to verify signature and issue JWT session
      const response = await fetch(`${API_URL}/api/auth/wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: activeAddress,
          signature,
          message,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Wallet authentication failed');
      }

      localStorage.setItem('proofpass_token', data.token);
      localStorage.setItem('proofpass_user_id', data.user_id);
      localStorage.setItem('proofpass_user_wallet', data.wallet_address || activeAddress);
      localStorage.setItem('proofpass_login_type', 'wallet');

      navigate('/dashboard');
    } catch (err) {
      setErr(err.message || 'Verification rejected or failed');
      if (isConnected) {
        disconnect();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErr('');

    try {
      const response = await fetch(`${API_URL}/api/auth/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Email login failed');
      }

      localStorage.setItem('proofpass_token', data.token);
      localStorage.setItem('proofpass_user_id', data.user_id);
      localStorage.setItem('proofpass_user_email', data.email || email);
      localStorage.setItem('proofpass_login_type', 'email');

      navigate('/dashboard');
    } catch (err) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVerify = () => {
    // Navigate directly to verify page
    const id = verifyId.trim() || "f0000000-0000-0000-0000-000000000001";
    navigate(`/verify/${id}`);
  };

  const handleOpenPortfolio = (slug) => {
    navigate(`/portfolio/${slug}`);
  };

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.dim }}>How it Works</span>
          <button style={styles.btnGhost} onClick={() => navigate('/verify/f0000000-0000-0000-0000-000000000001')}>🔍 Verify</button>
          <button style={{ ...styles.btnGhost, fontSize: 12 }} onClick={() => setLoginMode("email")}>Email Login</button>
          <button style={{ ...styles.btnBlue, fontSize: 12 }} onClick={handleWalletLogin} disabled={loading}>
            {loading ? 'Connecting...' : '🦊 Connect Wallet'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ textAlign: "center", padding: "64px 32px 48px" }}>
        <div style={{ ...styles.mono, fontSize: 10, color: C.teal, letterSpacing: 3, marginBottom: 16, textTransform: "uppercase" }}>
          Blockchain Identity · Polygon Amoy
        </div>
        <h1 style={{ ...styles.display, fontSize: 44, fontWeight: 800, color: C.white, lineHeight: 1.1, marginBottom: 14 }}>
          Verifiable Skills.<br />
          <span style={{ color: C.teal }}>Trusted Contributions.</span>
        </h1>
        <p style={{ color: C.dim, fontSize: 15, maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Blockchain-signed credentials anyone can verify instantly — no account, no app, no trust required.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{ ...styles.btnBlue, padding: "11px 24px" }} onClick={handleWalletLogin} disabled={loading}>
            {loading ? 'Authorizing...' : '🦊 Connect Wallet'}
          </button>
          <button style={{ ...styles.btnGhost, padding: "11px 24px" }} onClick={() => setLoginMode("email")}>Sign in with Email</button>
          <button style={{ ...styles.btnTeal, padding: "11px 24px" }} onClick={() => navigate('/verify/f0000000-0000-0000-0000-000000000001')}>🔍 Verify a Credential</button>
        </div>
        <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginTop: 12 }}>
          Logging in registers your account instantly. Try email: <b>alice@proofpass.io</b>
        </div>
      </div>

      {/* EMAIL LOGIN MODAL */}
      {loginMode === "email" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setLoginMode(null)}>
          <div style={{ ...styles.card, width: 360, padding: 32 }}>
            <div style={{ ...styles.display, fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 6 }}>Gatekeeper Auth</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 22 }}>Enter your work or institution email.</div>
            <form onSubmit={handleEmailLogin}>
              <label style={styles.label}>Email Address</label>
              <input style={{ ...styles.input, marginBottom: 16 }} value={email} onChange={e => setEmail(e.target.value)} placeholder="alice@proofpass.io" required type="email" />
              {err && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={styles.btnBlue} disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
                <button type="button" style={styles.btnGhost} onClick={() => setLoginMode(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATS */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 40 }}>
          {stats.map(s => (
            <div key={s.label} style={{ ...styles.card, textAlign: "center" }}>
              <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
              <div style={{ ...styles.mono, fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <div style={{ ...styles.display, fontWeight: 700, fontSize: 15, color: C.white, marginBottom: 16 }}>How ProofPass works</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[
            { step: "01", color: C.acc, title: "Institution Issues", desc: "Issuer logs in, fills the form, signs. Hash written to Polygon Amoy." },
            { step: "02", color: C.teal, title: "Credential Stored", desc: "Full data stored in database. SHA-256 hash anchored on-chain." },
            { step: "03", color: C.green, title: "Anyone Verifies", desc: "Scan QR or open URL. Instant result. No login. No app. Any browser." },
          ].map(s => (
            <div key={s.step} style={styles.card}>
              <div style={{ ...styles.mono, fontSize: 10, color: s.color, marginBottom: 6 }}>STEP {s.step}</div>
              <div style={{ fontSize: 14, color: C.white, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Inline verify search */}
        <div style={{ ...styles.card, marginTop: 32, padding: "24px 28px" }}>
          <div style={{ ...styles.display, fontWeight: 700, fontSize: 15, color: C.white, marginBottom: 12 }}>🔍 Quick Verify a Credential</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input style={{ ...styles.input, flex: 1 }} value={verifyId}
              onChange={e => setVerifyId(e.target.value)}
              placeholder="Enter credential ID, e.g. f0000000-0000-0000-0000-000000000001" />
            <button style={styles.btnTeal} onClick={handleQuickVerify}>Verify</button>
          </div>
          <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginTop: 8 }}>
            Try: f0000000-0000-0000-0000-000000000001 (Alice's seeded credential)
          </div>
          <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginTop: 6 }}>
            Or view a public portfolio:{" "}
            {["alice", "brian", "carol"].map((s, i) => (
              <span key={s}>{i > 0 && " · "}<span style={{ color: C.teal, cursor: "pointer", textDecoration: "underline" }} onClick={() => handleOpenPortfolio(s)}>{s}</span></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
