-- 1. Insert Users (Alice, Brian, Carol)
INSERT INTO users (id, email, wallet_address, github_username, reputation_score)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'alice@proofpass.io', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'alice-wanjiku', 95),
('b0000000-0000-0000-0000-000000000002', 'brian@proofpass.io', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'brian-go', 80),
('c0000000-0000-0000-0000-000000000003', 'carol@proofpass.io', '0x90F79bf6EB2c4f870365E785982E1f101E93b906', 'carol-ux', 85)
ON CONFLICT (email) DO NOTHING;

-- 2. Insert a Team
INSERT INTO teams (id, name, description)
VALUES 
('d0000000-0000-0000-0000-000000000001', 'Clairvoyance Core', 'Core development team building ProofPass decentralized verification.')
ON CONFLICT DO NOTHING;

-- 3. Insert Members
INSERT INTO members (id, team_id, user_id, role)
VALUES 
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Solidity Developer'),
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Go Backend Engineer'),
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'UI/UX Designer')
ON CONFLICT DO NOTHING;

-- 4. Insert initial dummy credential for Alice (Solidity Developer, Kenyatta University)
INSERT INTO credentials (id, title, description, hash, tx_hash, block_number, issuer_id, holder_id, status)
VALUES
(
  'f0000000-0000-0000-0000-000000000001',
  'Solidity Developer Credential',
  'Alice Wanjiku - Solidity Developer - Kenyatta University',
  '0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000', -- Dummy hash
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', -- Mock tx_hash
  4823901, -- Mock block number from target: Block #4,823,901
  'b0000000-0000-0000-0000-000000000002', -- Issued by Brian
  'a0000000-0000-0000-0000-000000000001', -- Held by Alice
  'active'
)
ON CONFLICT DO NOTHING;
