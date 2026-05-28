package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GetUserByEmail searches for a user by email address
func GetUserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (*User, error) {
	var user User
	query := `SELECT id, email, wallet_address, github_username, reputation_score, created_at 
	          FROM users WHERE email = $1`

	err := pool.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.WalletAddress, &user.GithubUsername, &user.ReputationScore, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // return nil user, nil error when not found
		}
		return nil, fmt.Errorf("failed to query user by email: %w", err)
	}
	return &user, nil
}

// GetUserByWallet searches for a user by wallet address
func GetUserByWallet(ctx context.Context, pool *pgxpool.Pool, wallet string) (*User, error) {
	var user User
	query := `SELECT id, email, wallet_address, github_username, reputation_score, created_at 
	          FROM users WHERE LOWER(wallet_address) = LOWER($1)`

	err := pool.QueryRow(ctx, query, wallet).Scan(
		&user.ID, &user.Email, &user.WalletAddress, &user.GithubUsername, &user.ReputationScore, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query user by wallet: %w", err)
	}
	return &user, nil
}

// CreateCredential inserts a newly issued credential block metadata
func CreateCredential(ctx context.Context, pool *pgxpool.Pool, cred *Credential) error {
	query := `INSERT INTO credentials (id, title, description, hash, tx_hash, block_number, issuer_id, holder_id, status)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err := pool.Exec(ctx, query,
		cred.ID, cred.Title, cred.Description, cred.Hash, cred.TxHash, cred.BlockNumber, cred.IssuerID, cred.HolderID, cred.Status,
	)
	if err != nil {
		return fmt.Errorf("failed to create credential: %w", err)
	}
	return nil
}

// GetCredentialByID returns credential and joined user details by ID
func GetCredentialByID(ctx context.Context, pool *pgxpool.Pool, id string) (*Credential, error) {
	var cred Credential
	// Select credential with joins to fetch holder/issuer details
	query := `SELECT c.id, c.title, c.description, c.hash, c.tx_hash, c.block_number, c.issuer_id, c.holder_id, c.status, c.created_at,
	                 COALESCE(h.github_username, h.email, 'Holder') as holder_name,
	                 COALESCE(i.github_username, i.email, 'Issuer') as issuer_name
	          FROM credentials c
	          LEFT JOIN users h ON c.holder_id = h.id
	          LEFT JOIN users i ON c.issuer_id = i.id
	          WHERE c.id = $1`

	err := pool.QueryRow(ctx, query, id).Scan(
		&cred.ID, &cred.Title, &cred.Description, &cred.Hash, &cred.TxHash, &cred.BlockNumber,
		&cred.IssuerID, &cred.HolderID, &cred.Status, &cred.CreatedAt, &cred.HolderName, &cred.IssuerName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query credential by ID: %w", err)
	}
	return &cred, nil
}

// GetCredentialsByHolder lists all credentials belonging to a user ID
func GetCredentialsByHolder(ctx context.Context, pool *pgxpool.Pool, holderID string) ([]Credential, error) {
	query := `SELECT c.id, c.title, c.description, c.hash, c.tx_hash, c.block_number, c.issuer_id, c.holder_id, c.status, c.created_at,
	                 COALESCE(h.github_username, h.email, 'Holder') as holder_name,
	                 COALESCE(i.github_username, i.email, 'Issuer') as issuer_name
	          FROM credentials c
	          LEFT JOIN users h ON c.holder_id = h.id
	          LEFT JOIN users i ON c.issuer_id = i.id
	          WHERE c.holder_id = $1 ORDER BY c.created_at DESC`

	rows, err := pool.Query(ctx, query, holderID)
	if err != nil {
		return nil, fmt.Errorf("failed to query credentials by holder: %w", err)
	}
	defer rows.Close()

	var credentials []Credential
	for rows.Next() {
		var cred Credential
		err := rows.Scan(
			&cred.ID, &cred.Title, &cred.Description, &cred.Hash, &cred.TxHash, &cred.BlockNumber,
			&cred.IssuerID, &cred.HolderID, &cred.Status, &cred.CreatedAt, &cred.HolderName, &cred.IssuerName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan credential row: %w", err)
		}
		credentials = append(credentials, cred)
	}

	return credentials, nil
}

// GetTeamsWithMembers retrieves all team logs and maps their members details
func GetTeamsWithMembers(ctx context.Context, pool *pgxpool.Pool) ([]Team, error) {
	// 1. Query all teams
	queryTeams := `SELECT id, name, description, created_at FROM teams`
	rowsTeams, err := pool.Query(ctx, queryTeams)
	if err != nil {
		return nil, fmt.Errorf("failed to query teams: %w", err)
	}
	defer rowsTeams.Close()

	var teams []Team
	for rowsTeams.Next() {
		var team Team
		if err := rowsTeams.Scan(&team.ID, &team.Name, &team.Description, &team.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan team row: %w", err)
		}
		teams = append(teams, team)
	}

	// 2. Load members for each team
	for idx, team := range teams {
		queryMembers := `SELECT m.id, m.team_id, m.user_id, m.role, m.created_at,
		                        COALESCE(u.github_username, u.email, 'Member') as name,
		                        COALESCE(u.github_username, '') as github_username,
		                        u.reputation_score
		                 FROM members m
		                 JOIN users u ON m.user_id = u.id
		                 WHERE m.team_id = $1`

		rowsM, err := pool.Query(ctx, queryMembers, team.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to query team members for team %s: %w", team.ID, err)
		}

		var members []Member
		for rowsM.Next() {
			var m Member
			err := rowsM.Scan(&m.ID, &m.TeamID, &m.UserID, &m.Role, &m.CreatedAt, &m.Name, &m.GithubUsername, &m.ReputationScore)
			if err != nil {
				rowsM.Close()
				return nil, fmt.Errorf("failed to scan member row: %w", err)
			}
			members = append(members, m)
		}
		rowsM.Close()
		teams[idx].Members = members
	}

	return teams, nil
}

// UpdateCredentialStatus sets a revoked status on-chain
func UpdateCredentialStatus(ctx context.Context, pool *pgxpool.Pool, id string, status string) error {
	query := `UPDATE credentials SET status = $1 WHERE id = $2`
	_, err := pool.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update credential status: %w", err)
	}
	return nil
}

// NullStringHelper returns a sql.NullString for schema null handling
func NullStringHelper(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: *s, Valid: true}
}

// GetUserBySlug searches for a user by github_username or email prefix (case-insensitive)
func GetUserBySlug(ctx context.Context, pool *pgxpool.Pool, slug string) (*User, error) {
	var user User
	query := `SELECT id, email, wallet_address, github_username, reputation_score, created_at 
	          FROM users 
	          WHERE LOWER(github_username) = LOWER($1) 
	             OR SPLIT_PART(LOWER(email), '@', 1) = LOWER($1)
	          LIMIT 1`

	err := pool.QueryRow(ctx, query, slug).Scan(
		&user.ID, &user.Email, &user.WalletAddress, &user.GithubUsername, &user.ReputationScore, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query user by slug: %w", err)
	}
	return &user, nil
}

