package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// User represents a credential issuer or holder
type User struct {
	ID             string    `json:"id"`
	Email          *string   `json:"email"`
	WalletAddress  *string   `json:"wallet_address"`
	GithubUsername *string   `json:"github_username"`
	ReputationScore int       `json:"reputation_score"`
	CreatedAt      time.Time `json:"created_at"`
}

// Team represents a group of contributors
type Team struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	Members     []Member  `json:"members,omitempty"`
}

// Member represents team membership linking users
type Member struct {
	ID             string    `json:"id"`
	TeamID         string    `json:"team_id"`
	UserID         string    `json:"user_id"`
	Role           string    `json:"role"`
	CreatedAt      time.Time `json:"created_at"`
	Name           string    `json:"name,omitempty"`            // Extracted helper
	GithubUsername string    `json:"github_username,omitempty"` // Extracted helper
	ReputationScore int      `json:"reputation,omitempty"`      // Extracted helper
}

// Credential represents proof record fields cached locally
type Credential struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Hash        string     `json:"hash"`
	TxHash      *string    `json:"tx_hash"`
	BlockNumber *int64     `json:"block_number"`
	IssuerID    *string    `json:"issuer_id"`
	HolderID    *string    `json:"holder_id"`
	Status      string     `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	HolderName  string     `json:"holder_name,omitempty"` // Joined helper
	IssuerName  string     `json:"issuer_name,omitempty"` // Joined helper
}

// InitDB initializes pgxpool and tests the database connection
func InitDB(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection pool config: %w", err)
	}

	// Set connection limits
	config.MaxConns = 15
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to establish connection pool: %w", err)
	}

	// Ping database to verify live availability
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}
