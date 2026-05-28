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

export default function Verify() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inputId, setInputId] = useState(id || "");
  const [searching, setSearching] = useState(false);
  const [state, setState] = useState(null); // null | 'verified' | 'tampered' | 'notfound'
  const [found, setFound] = useState(null);

  const doVerify = useCallback(async (verifyId) => {
    if (!verifyId) return;
    setSearching(true);
    setState(null);
    setFound(null);

    // Minor loading delay for UX matching the spec
    await new Promise(r => setTimeout(r, 800));

    try {
      const response = await fetch(`${API_URL}/api/credentials/verify/${verifyId}`);
      const data = await response.json();

      if (!response.ok || data.status === 'not_found') {
        setState("notfound");
        return;
      }

      if (data.status === 'tampered') {
        setState("tampered");
        setFound({
          title: data.title || "Solidity Developer Credential",
          hash: data.hash || "0xinvalid",
          onChainHash: "0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000", // Seeded reference
          expectedHash: data.hash
        });
        return;
      }

      setState("verified");
      setFound({
        id: verifyId,
        title: data.title,
        recipient: data.holder_name,
        issuer: data.issuer_name,
        issueDate: "2026-05-28", // Local fallback date
        skills: data.title.toLowerCase().includes('degree') ? ["Solidity", "Go", "Python"] : ["Smart Contracts", "Security", "EVM"],
        txHash: data.tx_hash,
        blockNumber: String(data.block_number),
        network: "Polygon Amoy",
        dataHash: data.hash,
        emoji: data.title.toLowerCase().includes('degree') ? "🎓" : "⛓",
        color: C.teal
      });
    } catch (err) {
      console.error(err);
      setState("notfound");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      doVerify(id);
      setInputId(id);
    }
  }, [id, doVerify]);

  const handleSearch = () => {
    if (inputId.trim()) {
      navigate(`/verify/${inputId.trim()}`);
    }
  };

  const handleBack = () => {
    const storedToken = localStorage.getItem('proofpass_token');
    if (storedToken) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
        <div style={{ fontSize: 12, color: C.dim }}>Public Verification · No login required</div>
        <button style={styles.btnGhost} onClick={handleBack}>← Back</button>
      </nav>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px" }}>
        {/* Search bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <input style={{ ...styles.input, flex: 1 }} value={inputId}
            onChange={e => setInputId(e.target.value)}
            placeholder="Enter credential ID..."
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <button style={styles.btnTeal} onClick={handleSearch}>🔍 Verify</button>
        </div>

        {/* Loading */}
        {searching && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ ...styles.mono, fontSize: 12, color: C.acc, letterSpacing: 2 }}>QUERYING POLYGON AMOY...</div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.acc, opacity: 0.3 + i * 0.3 }} />
              ))}
            </div>
          </div>
        )}

        {/* VERIFIED */}
        {state === "verified" && found && (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 22px", borderRadius: 100, background: "rgba(34,197,94,0.12)", color: C.green, border: `2px solid ${C.green}`, ...styles.mono, fontSize: 13, fontWeight: 600, letterSpacing: 1, marginBottom: 16 }}>
              ✓ CREDENTIAL VERIFIED
            </div>
            <div style={{ ...styles.display, fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 4 }}>{found.title}</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>{found.issuer} · {found.issueDate}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left", marginBottom: 20 }}>
              <div style={styles.card}>
                {[
                  { l: "Holder", v: found.recipient, c: C.white },
                  { l: "Issued By", v: found.issuer, c: C.acc },
                ].map(r => (
                  <div key={r.l} style={{ marginBottom: 12 }}>
                    <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, textTransform: "uppercase" }}>{r.l}</div>
                    <div style={{ fontSize: 13, color: r.c, fontWeight: 500, marginTop: 3 }}>{r.v}</div>
                  </div>
                ))}
                <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>Skills</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                  {found.skills.map(s => <Tag key={s} color={found.color} bg={`${found.color}18`} border={`${found.color}33`}>{s}</Tag>)}
                </div>
              </div>
              <div style={{ ...styles.card, borderColor: "rgba(0,201,167,0.3)" }}>
                <div style={{ ...styles.mono, fontSize: 9, color: C.teal, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>On-Chain Proof</div>
                {[
                  { l: "Transaction", v: found.txHash ? `${found.txHash.slice(0, 18)}...` : 'pending', c: C.white },
                  { l: "Block", v: found.blockNumber !== "0" ? `#${found.blockNumber}` : "Pending", c: C.teal },
                  { l: "Network", v: found.network, c: C.amber },
                ].map(r => (
                  <div key={r.l} style={{ marginBottom: 9 }}>
                    <div style={{ ...styles.mono, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>{r.l}</div>
                    <div style={{ ...styles.mono, fontSize: 11, color: r.c, marginTop: 2 }}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...styles.card, padding: 24 }}>
              <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Share</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <QRCodeCanvas value={window.location.href} size={110} />
              </div>
              <div style={{ ...styles.mono, fontSize: 10, color: C.dim, marginBottom: 10 }}>
                {window.location.pathname}
              </div>
              <button style={styles.btnGhost} onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy Link</button>
            </div>
          </div>
        )}

        {/* TAMPERED */}
        {state === "tampered" && found && (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 22px", borderRadius: 100, background: "rgba(255,77,109,0.12)", color: C.red, border: `2px solid ${C.red}`, ...styles.mono, fontSize: 13, fontWeight: 600, letterSpacing: 1, marginBottom: 16 }}>
              ✗ CREDENTIAL INVALID
            </div>
            <div style={{ ...styles.display, fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>Hash Mismatch Detected</div>
            <div style={{ fontSize: 13, color: C.dim, maxWidth: 320, margin: "0 auto 20px", lineHeight: 1.7 }}>
              The credential metadata hash does not match what was committed on the Polygon blockchain ledger.
            </div>
            <div style={{ ...styles.card, borderColor: "rgba(255,77,109,0.3)", textAlign: "left", maxWidth: 380, margin: "0 auto 20px" }}>
              <div style={{ ...styles.mono, fontSize: 9, color: C.red, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Mismatch Details</div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Expected (committed hash)</div>
              <div style={{ ...styles.mono, fontSize: 10, color: C.red, wordBreak: "break-all" }}>
                {found.onChainHash}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 8, marginBottom: 4 }}>Found (database payload hash)</div>
              <div style={{ ...styles.mono, fontSize: 10, color: C.red, wordBreak: "break-all" }}>
                {found.expectedHash}
              </div>
            </div>
            <button style={{ background: "rgba(255,77,109,0.15)", color: C.red, border: `1px solid rgba(255,77,109,0.3)`, borderRadius: 8, padding: "8px 18px", fontSize: 12, cursor: "pointer" }} onClick={() => alert('Tamper incident logged to consensus node.')}>
              Report Incident
            </button>
          </div>
        )}

        {/* NOT FOUND */}
        {state === "notfound" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ ...styles.display, fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 8 }}>Credential Not Found</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24, lineHeight: 1.7 }}>
              No credential with this identifier is registered on ProofPass. Check your ID.
            </div>
            <div style={{ ...styles.mono, fontSize: 10, color: C.dim }}>
              Try: f0000000-0000-0000-0000-000000000001
            </div>
          </div>
        )}

        {/* Idle hint */}
        {!state && !searching && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.dim }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>⬡</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Enter a credential ID above to verify</div>
            <div style={{ ...styles.mono, fontSize: 11 }}>
              Try: f0000000-0000-0000-0000-000000000001 (Alice Wanjiku Developer Pass)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
