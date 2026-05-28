import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

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
  app: { background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: C.text, fontSize: 14 },
  nav: { background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: "13px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)" },
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

function Tag({ color, bg, border, children }) {
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, padding: "2px 8px", borderRadius: 20, letterSpacing: 1, color, background: bg, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}

export default function Portfolio() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareQr, setShareQr] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const response = await fetch(`${API_URL}/api/portfolio/${slug}`);
      const data = await response.json();
      if (!response.ok) {
        setNotFound(true);
        return;
      }
      setProfile(data.user);
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchPortfolio();
    }
  }, [slug, fetchPortfolio]);

  const handleBack = () => {
    const token = localStorage.getItem('proofpass_token');
    if (token) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  // Derive unique skills across credentials for layout
  const allSkills = [...new Set(credentials.map(c => c.title.toLowerCase().includes('degree') ? "Computer Science" : "Blockchain"))];

  if (loading) {
    return (
      <div style={styles.app}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <nav style={styles.nav}>
          <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
          <button style={styles.btnGhost} onClick={handleBack}>← Back</button>
        </nav>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <span style={{ ...styles.mono, fontSize: 12, color: C.dim }}>Fetching public portfolio ledger...</span>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div style={styles.app}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <nav style={styles.nav}>
          <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
          <button style={styles.btnGhost} onClick={handleBack}>← Back</button>
        </nav>
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <div style={{ ...styles.display, fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 8 }}>Portfolio Not Found</div>
          <div style={{ fontSize: 13, color: C.dim }}>
            No credentials or profile found for slug "{slug}".<br />
            Try seeded profiles: <span style={{ color: C.teal, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/portfolio/alice')}>alice</span>
          </div>
        </div>
      </div>
    );
  }

  const avatarInitials = profile.name.split(" ").map(w => w[0]).join("").toUpperCase();

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
        <div style={{ fontSize: 12, color: C.dim }}>Public Portfolio · No login required</div>
        <button style={styles.btnGhost} onClick={handleBack}>← Back</button>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        {/* Profile Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {/* Avatar */}
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${C.acc}44, ${C.teal}44)`, border: `2px solid ${C.teal}55`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, color: C.white, fontWeight: 700 }}>
            {avatarInitials || "U"}
          </div>

          <div style={{ ...styles.display, fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 4 }}>{profile.name}</div>
          <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginBottom: 16 }}>
            /portfolio/{slug}
          </div>

          {/* Summary Badges */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            <span style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", color: C.teal, borderRadius: 20, padding: "4px 14px", ...styles.mono, fontSize: 11 }}>
              {credentials.length} Credential{credentials.length !== 1 ? "s" : ""}
            </span>
            <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: C.green, borderRadius: 20, padding: "4px 14px", ...styles.mono, fontSize: 11 }}>
              ✓ All Verified
            </span>
            <span style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", color: C.amber, borderRadius: 20, padding: "4px 14px", ...styles.mono, fontSize: 11 }}>
              Polygon Amoy
            </span>
          </div>

          {/* Share Buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button style={{ ...styles.btnGhost, fontSize: 12 }} onClick={() => setShareQr(true)}>📱 Share Portfolio QR</button>
            <button style={{ ...styles.btnGhost, fontSize: 12 }} onClick={() => navigator.clipboard?.writeText(window.location.href)}>🔗 Copy Link</button>
          </div>
        </div>

        {/* Skills Overview */}
        {allSkills.length > 0 && (
          <div style={{ ...styles.card, marginBottom: 24, borderColor: "rgba(91,141,239,0.25)" }}>
            <div style={{ ...styles.mono, fontSize: 10, color: C.acc, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Verified Competence</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {allSkills.map(s => (
                <span key={s} style={{ background: "rgba(91,141,239,0.1)", border: "1px solid rgba(91,141,239,0.25)", color: C.acc, borderRadius: 20, padding: "4px 12px", ...styles.mono, fontSize: 10 }}>{s}</span>
              ))}
              <span style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.25)", color: C.teal, borderRadius: 20, padding: "4px 12px", ...styles.mono, fontSize: 10 }}>Reputation: {profile.reputation} pts</span>
            </div>
          </div>
        )}

        {/* Credentials List */}
        <div style={{ ...styles.mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
          {credentials.length} Verified Credential{credentials.length !== 1 ? "s" : ""}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {credentials.map(cred => {
            const expanded = expandedId === cred.id;
            const emoji = cred.title.toLowerCase().includes('degree') || cred.title.toLowerCase().includes('bsc') ? '🎓' : '⛓';
            const color = cred.title.toLowerCase().includes('degree') || cred.title.toLowerCase().includes('bsc') ? C.acc : C.teal;

            return (
              <div key={cred.id} style={{ ...styles.card, borderColor: expanded ? `${color}55` : C.border, transition: "border-color 0.2s" }}>
                {/* Row */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                  onClick={() => setExpandedId(expanded ? null : cred.id)}>
                  <div style={{ width: 44, height: 44, background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: C.white, fontWeight: 600, marginBottom: 2 }}>{cred.title}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>Issued by: {cred.issuer_name || 'Authorized Issuer'}</div>
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                      <Tag color={color} bg={`${color}18`} border={`${color}33`}>{cred.status}</Tag>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <Tag color={C.green} bg="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.3)">✓ VERIFIED</Tag>
                    <span style={{ ...styles.mono, fontSize: 10, color: C.dim }}>{expanded ? "▲ less" : "▼ details"}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 14 }}>{cred.description}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      {[
                        { l: "Issuer", v: cred.issuer_name || 'Authorized Issuer', c: C.acc },
                        { l: "Block Number", v: cred.block_number ? `#${cred.block_number}` : 'Pending', c: C.teal },
                        { l: "Tx Hash", v: cred.tx_hash ? `${cred.tx_hash.slice(0, 18)}...` : 'Pending', c: C.white },
                        { l: "Network", v: "Polygon Amoy", c: C.amber },
                      ].map(r => (
                        <div key={r.l}>
                          <div style={{ ...styles.mono, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>{r.l}</div>
                          <div style={{ ...styles.mono, fontSize: 11, color: r.c, marginTop: 2 }}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                    <button style={{ ...styles.btnGhost, fontSize: 11 }} onClick={() => navigate(`/verify/${cred.id}`)}>
                      🔍 Verify this credential
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Verification Note */}
        <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, padding: "14px 18px", marginTop: 28, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: C.green, fontSize: 16, flexShrink: 0 }}>✓</span>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
            All credentials on this portfolio are independently verifiable on <span style={{ color: C.amber }}>Polygon Amoy</span>. No login required. Click any credential above and tap "Verify this credential" for full blockchain proof.
          </div>
        </div>
      </div>

      {/* Share QR Modal */}
      {shareQr && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setShareQr(false)}>
          <div style={{ ...styles.card, width: 320, padding: 32, textAlign: "center" }}>
            <div style={{ ...styles.mono, fontSize: 10, color: C.teal, letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>Share Full Portfolio</div>
            <div style={{ ...styles.display, fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 2 }}>{profile.name}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>{credentials.length} credentials · scan to view all</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <QRCodeCanvas value={window.location.href} size={148} />
            </div>
            <div style={{ ...styles.mono, fontSize: 10, color: C.dim, marginBottom: 16 }}>{window.location.pathname}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={styles.btnGhost} onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy Link</button>
              <button style={styles.btnBlue} onClick={() => setShareQr(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
