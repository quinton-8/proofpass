import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('credentials'); // 'credentials' | 'issue' | 'team'
  const [token, setToken] = useState('');
  const [userProfile, setUserProfile] = useState({
    name: 'Authorized Account',
    email: '',
    wallet: '',
    reputation: 90,
  });

  // State caches
  const [credentials, setCredentials] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [qrModal, setQrModal] = useState(null);
  const [portfolioQr, setPortfolioQr] = useState(false);

  // Form states for issuing new credentials
  const [form, setForm] = useState({ recipientName: '', recipientEmail: '', title: '', description: '', type: 'certificate', skills: '' });
  const [issueStep, setIssueStep] = useState('form'); // 'form' | 'signing' | 'success'
  const [sigStep, setSigStep] = useState(0);
  const [issueResult, setIssueResult] = useState(null);

  const sigSteps = [
    { label: "Computing SHA-256 hash...", color: C.acc },
    { label: "Submitting issueCredential() to Polygon Amoy...", color: C.amber },
    { label: "Waiting for block confirmation...", color: C.teal },
    { label: "Saving to database...", color: C.purple },
    { label: "Generating QR URL...", color: C.green },
  ];

  useEffect(() => {
    const storedToken = localStorage.getItem('proofpass_token');
    if (!storedToken) {
      navigate('/');
      return;
    }
    setToken(storedToken);

    // Map user profile details from auth cache
    const email = localStorage.getItem('proofpass_user_email') || '';
    const wallet = localStorage.getItem('proofpass_user_wallet') || '';
    const loginType = localStorage.getItem('proofpass_login_type') || '';

    setUserProfile({
      name: loginType === 'wallet' ? 'Web3 Issuer' : email.split('@')[0],
      email: email,
      wallet: wallet,
      reputation: loginType === 'wallet' ? 95 : 85
    });

    fetchData(storedToken);
  }, [navigate]);

  const fetchData = async (sessionToken) => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch credentials
      const credRes = await fetch(`${API_URL}/api/credentials/my`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const credData = await credRes.json();
      if (credRes.ok) {
        setCredentials(credData.credentials || []);
      }

      // 2. Fetch Teams and Members progress
      const teamRes = await fetch(`${API_URL}/api/teams`);
      const teamData = await teamRes.json();
      if (teamRes.ok) {
        setTeams(teamData.teams || []);
      }
    } catch (err) {
      setErrorMsg('Failed to load live data from backend api.');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCredential = async (e) => {
    e.preventDefault();
    if (!form.recipientEmail || !form.title) return;

    setIssueStep('signing');
    setSigStep(0);
    setErrorMsg('');

    // Trigger signing progress animations
    const animationPromise = (async () => {
      for (let i = 0; i < sigSteps.length; i++) {
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        setSigStep(i + 1);
      }
    })();

    // Make the backend call
    const apiPromise = (async () => {
      const response = await fetch(`${API_URL}/api/credentials/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || `${form.recipientName || 'Holder'} - ${form.title}`,
          holder_email: form.recipientEmail
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue credential');
      }
      return data;
    })();

    try {
      const [_, resultData] = await Promise.all([animationPromise, apiPromise]);

      setIssueResult({
        id: resultData.credential_id,
        title: form.title,
        recipient: form.recipientName || form.recipientEmail,
        issueDate: new Date().toISOString().slice(0, 10),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        txHash: resultData.tx_hash,
        blockNumber: String(resultData.block_number),
        network: "Polygon Amoy",
        dataHash: resultData.hash,
        emoji: form.type === "degree" ? "🎓" : form.type === "participation" ? "🏅" : "⛓",
        color: C.teal,
      });

      setIssueStep('success');
      // Refresh list
      fetchData(token);
    } catch (err) {
      setErrorMsg(err.message);
      setIssueStep('form');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('proofpass_token');
    localStorage.removeItem('proofpass_user_id');
    localStorage.removeItem('proofpass_user_email');
    localStorage.removeItem('proofpass_user_wallet');
    localStorage.removeItem('proofpass_login_type');
    navigate('/');
  };

  const slug = userProfile.name.split(" ")[0].toLowerCase();
  const portfolioUrl = `${window.location.origin}/portfolio/${slug}`;

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={styles.nav}>
        <div style={styles.brand} onClick={() => navigate('/')}>⬡ ProofPass</div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: activeTab === 'credentials' ? C.white : C.dim, fontWeight: activeTab === 'credentials' ? 500 : 400, borderBottom: activeTab === 'credentials' ? `2px solid ${C.acc}` : 'none', paddingBottom: 2, cursor: 'pointer' }} onClick={() => { setActiveTab('credentials'); setIssueStep('form'); }}>Dashboard</span>
          <span style={{ fontSize: 13, color: activeTab === 'team' ? C.white : C.dim, fontWeight: activeTab === 'team' ? 500 : 400, borderBottom: activeTab === 'team' ? `2px solid ${C.acc}` : 'none', paddingBottom: 2, cursor: 'pointer' }} onClick={() => { setActiveTab('team'); setIssueStep('form'); }}>Team</span>
          <span style={{ fontSize: 13, color: C.dim, cursor: "pointer" }} onClick={() => navigate(`/portfolio/${slug}`)}>Portfolio</span>
          <button style={{ ...styles.btnBlue, fontSize: 12 }} onClick={() => setActiveTab('issue')}>⛓ Issue</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Tag color={C.green} bg="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.3)">● Connected</Tag>
          <span style={{ ...styles.mono, fontSize: 11, color: C.dim }}>
            {userProfile.wallet ? `${userProfile.wallet.slice(0, 8)}...${userProfile.wallet.slice(-4)}` : userProfile.email}
          </span>
          <button style={{ ...styles.btnGhost, fontSize: 11 }} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 28px" }}>
        {errorMsg && (
          <div style={{ ...styles.card, borderColor: C.red, background: 'rgba(255,77,109,0.03)', color: C.text, marginBottom: 24, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, color: C.red, marginTop: -2 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...styles.display, fontWeight: 700, color: C.white, marginBottom: 6, fontSize: 15 }}>Blockchain Transaction Failed</div>
                <div style={{ ...styles.mono, fontSize: 12, color: C.red, background: 'rgba(255,77,109,0.06)', padding: '10px 14px', borderRadius: 8, border: `1px solid rgba(255,77,109,0.15)`, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {errorMsg}
                </div>
                {(errorMsg.toLowerCase().includes('insufficient funds') || errorMsg.toLowerCase().includes('gas') || errorMsg.toLowerCase().includes('balance')) && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ ...styles.mono, fontSize: 10, color: C.amber, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
                      💡 Need Testnet POL Tokens?
                    </div>
                    <p style={{ color: C.dim, fontSize: 12, margin: '0 0 12px 0', lineHeight: 1.6 }}>
                      The issuer wallet address does not have enough native tokens to pay for the gas fee required to anchor this credential. Request test tokens from these faucets:
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                      <a href="https://faucet.polygon.technology/" target="_blank" rel="noopener noreferrer" style={{ ...styles.btnGhost, fontSize: 11, padding: '6px 12px', textDecoration: 'none', color: C.teal, borderColor: 'rgba(0,201,167,0.3)' }}>
                        🚰 Polygon Official Faucet
                      </a>
                      <a href="https://www.alchemy.com/faucets/polygon-amoy" target="_blank" rel="noopener noreferrer" style={{ ...styles.btnGhost, fontSize: 11, padding: '6px 12px', textDecoration: 'none', color: C.acc, borderColor: 'rgba(91,141,239,0.3)' }}>
                        🧪 Alchemy Amoy Faucet
                      </a>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
                      <strong>Running locally?</strong> Make sure your backend <code style={{ color: C.white, background: C.bg3, padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace' }}>.env</code> file has <code style={{ color: C.white }}>ISSUER_PRIVATE_KEY</code> set to a pre-funded Hardhat account key (e.g. Account #0 key: <code style={{ color: C.white }}>ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80</code>).
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Credentials List */}
        {activeTab === 'credentials' && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <div style={{ ...styles.mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>Welcome Back</div>
                <div style={{ ...styles.display, fontSize: 26, fontWeight: 800, color: C.white }}>{userProfile.name}</div>
                <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginTop: 3 }}>
                  {userProfile.wallet || userProfile.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Credentials", value: credentials.length, color: C.teal },
                  { label: "Verified", value: credentials.filter(c => c.status === "active").length, color: C.green },
                ].map(s => (
                  <div key={s.label} style={{ ...styles.card, textAlign: "center", minWidth: 90, padding: "14px 20px" }}>
                    <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ ...styles.mono, fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio share banner */}
            {credentials.length > 0 && (
              <div style={{ ...styles.card, borderColor: "rgba(0,201,167,0.3)", background: "rgba(0,201,167,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, padding: "14px 20px" }}>
                <div>
                  <div style={{ fontSize: 13, color: C.white, fontWeight: 600, marginBottom: 2 }}>📋 Your Public Portfolio</div>
                  <div style={{ ...styles.mono, fontSize: 11, color: C.dim }}>
                    {slug} profile — all your credentials in one link
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button style={{ ...styles.btnGhost, fontSize: 11 }} onClick={() => setPortfolioQr(true)}>📱 Portfolio QR</button>
                  <button style={{ ...styles.btnTeal, fontSize: 11 }} onClick={() => navigate(`/portfolio/${slug}`)}>View Portfolio</button>
                </div>
              </div>
            )}

            <div style={{ ...styles.display, fontWeight: 700, fontSize: 15, color: C.white, marginBottom: 14 }}>
              My Credentials
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <span style={{ ...styles.mono, fontSize: 12, color: C.dim }}>Loading from registry...</span>
              </div>
            ) : credentials.length === 0 ? (
              <div style={{ ...styles.card, textAlign: "center", padding: 48, color: C.dim }}>
                No credentials yet in this account registry.
                <button style={{ ...styles.btnBlue, marginLeft: 12 }} onClick={() => setActiveTab('issue')}>Issue New Credential</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {credentials.map(cred => {
                  const emoji = cred.title.toLowerCase().includes('degree') || cred.title.toLowerCase().includes('bsc') ? '🎓' : '⛓';
                  const color = cred.title.toLowerCase().includes('degree') || cred.title.toLowerCase().includes('bsc') ? C.acc : C.teal;

                  return (
                    <div key={cred.id} style={{ ...styles.card, display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 46, height: 46, background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: C.white, fontWeight: 600, marginBottom: 2 }}>{cred.title}</div>
                        <div style={{ fontSize: 11, color: C.dim }}>
                          Issued by: {cred.issuer_name || 'Authorized Issuer'} · Block #{cred.block_number || 'Pending'}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
                          <Tag color={color} bg={`${color}18`} border={`${color}33`}>{cred.status}</Tag>
                          <Tag color={C.purple} bg="rgba(167,139,250,0.1)" border="rgba(167,139,250,0.2)">Polygon Amoy</Tag>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, flexShrink: 0 }}>
                        <Tag color={C.green} bg="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.3)">✓ VERIFIED</Tag>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }} onClick={() => setQrModal(cred)}>📱 QR Code</button>
                          <button style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 10px" }} onClick={() => navigate(`/verify/${cred.id}`)}>🔍 Verify</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Team View */}
        {activeTab === 'team' && (
          <div>
            <div style={{ ...styles.mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>Hackathon Team</div>
            <div style={{ ...styles.display, fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 6 }}>Contribution Ledger</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 28 }}>Reputation scores and roles calculated from ledger issues.</div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <span style={{ ...styles.mono, fontSize: 12, color: C.dim }}>Loading contributors...</span>
              </div>
            ) : teams.length === 0 ? (
              <div style={{ ...styles.card, textAlign: 'center', padding: 48, color: C.dim }}>
                No active team logs found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {teams.map(team => (
                  <div key={team.id} style={styles.card}>
                    <div style={{ ...styles.display, fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>{team.name}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>{team.description}</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {team.members && team.members.map(member => (
                        <div key={member.id} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{member.name}</div>
                            <div style={{ fontSize: 11, color: C.dim }}>{member.role} {member.github_username && `· @${member.github_username}`}</div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 150 }}>
                            <div style={{ ...styles.mono, fontSize: 10, color: C.teal, marginBottom: 4 }}>Reputation: {member.reputation} pts</div>
                            <div style={{ width: '100%', height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(member.reputation, 100)}%`, height: '100%', background: C.teal }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Issue Credential */}
        {activeTab === 'issue' && (
          <div>
            {issueStep === 'form' && (
              <div>
                <div style={{ ...styles.mono, fontSize: 10, color: C.acc, letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>Issuer Console</div>
                <div style={{ ...styles.display, fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 4 }}>Issue New Credential</div>
                <div style={{ fontSize: 13, color: C.dim, marginBottom: 32 }}>Fill the form · backend hashes fields · writes to Polygon · stores in DB · generates QR URL.</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                  <form onSubmit={handleIssueCredential}>
                    {[
                      { key: "recipientEmail", label: "Recipient Email Address", placeholder: "alice@proofpass.io", type: "email" },
                      { key: "recipientName", label: "Recipient Name", placeholder: "Alice Wanjiku", type: "text" },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={styles.label}>{f.label}</label>
                        <input style={styles.input} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} required={f.key === 'recipientEmail'} type={f.type} />
                      </div>
                    ))}

                    <div style={{ marginBottom: 14 }}>
                      <label style={styles.label}>Credential Type</label>
                      <select style={{ ...styles.input }} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        <option value="degree">Degree</option>
                        <option value="certificate">Certificate</option>
                        <option value="participation">Participation</option>
                        <option value="skill">Skill Badge</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={styles.label}>Title</label>
                      <input style={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="BSc. Computer Science" required />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={styles.label}>Description</label>
                      <textarea style={{ ...styles.input, height: 72, resize: "vertical" }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="4-year programme, graduated with honours..." />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={styles.label}>Skills (comma-separated)</label>
                      <input style={styles.input} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="Solidity, Go, Blockchain" />
                    </div>

                    <button type="submit" style={{ ...styles.btnBlue, marginTop: 6, padding: "11px 22px" }}
                      disabled={!form.recipientEmail || !form.title}>
                      ⛓ Sign &amp; Issue on Blockchain
                    </button>
                    <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginTop: 8 }}>
                      Signing with: {userProfile.wallet || 'JWT Signer'}
                    </div>
                  </form>

                  {/* HOW IT WORKS */}
                  <div>
                    <div style={{ ...styles.mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>What happens when you click issue</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { n: 1, c: C.acc, title: "Hash credential data", desc: "SHA-256 of all fields combined" },
                        { n: 2, c: C.amber, title: "Write hash to Polygon", desc: "issueCredential(id, hash) on-chain" },
                        { n: 3, c: C.teal, title: "Store in database", desc: "Credential + tx_hash + block_number saved" },
                        { n: 4, c: C.green, title: "Return QR URL", desc: "proofpass.io/verify/:id — ready to share", highlight: true },
                      ].map(s => (
                        <div key={s.n} style={{ ...styles.card, display: "flex", gap: 12, alignItems: "flex-start", borderColor: s.highlight ? "rgba(34,197,94,0.3)" : C.border }}>
                          <div style={{ width: 22, height: 22, background: s.c, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: s.n === 1 ? "#fff" : "#000", flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                          <div>
                            <div style={{ fontSize: 12, color: C.white, fontWeight: 500 }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: C.dim }}>{s.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {issueStep === 'signing' && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                <div style={{ ...styles.card, width: 420, padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⛓</div>
                  <div style={{ ...styles.display, fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 24 }}>Writing to Polygon Amoy...</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sigSteps.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: i < sigStep ? `${s.color}18` : C.bg3, border: `1px solid ${i < sigStep ? s.color + "44" : C.border}`, transition: "all 0.4s" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: i < sigStep ? s.color : C.bg3, border: `1px solid ${i < sigStep ? s.color : C.border2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: i < sigStep ? "#000" : C.dim, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                          {i < sigStep ? "✓" : i + 1}
                        </div>
                        <span style={{ fontSize: 12, color: i < sigStep ? C.white : C.dim }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {issueStep === 'success' && issueResult && (
              <div style={{ textAlign: "center" }}>
                <div style={{ ...styles.display, fontSize: 28, fontWeight: 800, color: C.green, marginBottom: 6 }}>✓ Credential Issued!</div>
                <div style={{ fontSize: 14, color: C.dim, marginBottom: 32 }}>Successfully anchored on Polygon Amoy.</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, textAlign: "left" }}>
                  <div style={styles.card}>
                    <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Credential Details</div>
                    {[
                      { l: "Title", v: issueResult.title, c: C.white },
                      { l: "Recipient", v: issueResult.recipient, c: C.teal },
                      { l: "Issuer", v: userProfile.name, c: C.acc },
                      { l: "Date", v: issueResult.issueDate, c: C.text },
                    ].map(r => (
                      <div key={r.l} style={{ marginBottom: 10 }}>
                        <div style={{ ...styles.mono, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>{r.l}</div>
                        <div style={{ fontSize: 13, color: r.c, fontWeight: 500, marginTop: 2 }}>{r.v}</div>
                      </div>
                    ))}
                    <div style={{ ...styles.mono, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 4 }}>Skills</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                      {issueResult.skills.map(s => <Tag key={s} color={C.teal} bg="rgba(0,201,167,0.1)" border="rgba(0,201,167,0.3)">{s}</Tag>)}
                    </div>
                  </div>
                  <div style={{ ...styles.card, borderColor: "rgba(0,201,167,0.3)" }}>
                    <div style={{ ...styles.mono, fontSize: 9, color: C.teal, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>On-Chain Proof</div>
                    {[
                      { l: "Transaction", v: `${issueResult.txHash.slice(0, 18)}...`, c: C.white },
                      { l: "Block", v: `#${issueResult.blockNumber}`, c: C.teal },
                      { l: "Network", v: issueResult.network, c: C.amber },
                    ].map(r => (
                      <div key={r.l} style={{ marginBottom: 10 }}>
                        <div style={{ ...styles.mono, fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1.5 }}>{r.l}</div>
                        <div style={{ ...styles.mono, fontSize: 12, color: r.c, marginTop: 2 }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* QR */}
                <div style={{ ...styles.card, padding: 28 }}>
                  <div style={{ ...styles.mono, fontSize: 9, color: C.dim, letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>Share This Credential</div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <QRCodeCanvas value={`${window.location.origin}/verify/${issueResult.id}`} size={140} />
                  </div>
                  <div style={{ ...styles.mono, fontSize: 11, color: C.dim, marginBottom: 14 }}>
                    verify/{issueResult.id}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button style={styles.btnGhost} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/verify/${issueResult.id}`)}>Copy Link</button>
                    <button style={styles.btnTeal} onClick={() => { setIssueStep('form'); setActiveTab('credentials'); }}>← Dashboard</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PORTFOLIO QR MODAL */}
      {portfolioQr && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setPortfolioQr(false)}>
          <div style={{ ...styles.card, width: 340, padding: 32, textAlign: "center" }}>
            <div style={{ ...styles.mono, fontSize: 10, color: C.teal, letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Public Portfolio</div>
            <div style={{ ...styles.display, fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 2 }}>{userProfile.name}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>{credentials.length} verified credentials</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <QRCodeCanvas value={portfolioUrl} size={148} />
            </div>
            <div style={{ ...styles.mono, fontSize: 10, color: C.dim, marginBottom: 16 }}>
              /portfolio/{slug}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={styles.btnGhost} onClick={() => navigator.clipboard?.writeText(portfolioUrl)}>Copy Link</button>
              <button style={styles.btnTeal} onClick={() => { setPortfolioQr(false); navigate(`/portfolio/${slug}`); }}>Open Portfolio</button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIAL QR MODAL */}
      {qrModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => e.target === e.currentTarget && setQrModal(null)}>
          <div style={{ ...styles.card, width: 320, padding: 32, textAlign: "center" }}>
            <div style={{ ...styles.display, fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 4 }}>{qrModal.title}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 20 }}>{qrModal.issuer_name || 'Authorized Issuer'}</div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <QRCodeCanvas value={`${window.location.origin}/verify/${qrModal.id}`} size={140} />
            </div>
            <div style={{ ...styles.mono, fontSize: 10, color: C.dim, marginBottom: 14 }}>
              /verify/{qrModal.id}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={styles.btnGhost} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/verify/${qrModal.id}`)}>Copy Link</button>
              <button style={styles.btnBlue} onClick={() => setQrModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
