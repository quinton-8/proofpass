package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/blockchain"
	"backend/db"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var jwtKey = []byte("super-secret-proofpass-key")

// HandlerContext contains shared dependencies injected at server start
type HandlerContext struct {
	DB *pgxpool.Pool
	BC *blockchain.BlockchainClient
}

type WalletLoginRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
	Message       string `json:"message" binding:"required"`
}

type EmailLoginRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type Claims struct {
	UserID        string `json:"user_id"`
	Email         string `json:"email,omitempty"`
	WalletAddress string `json:"wallet_address,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken helper creates signed JWT tokens
func GenerateToken(userID, email, wallet string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:        userID,
		Email:         email,
		WalletAddress: wallet,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// VerifySignature validates Ethereum personal signatures
func VerifySignature(walletAddress, signature, message string) bool {
	msgBytes := []byte(message)
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(msgBytes))
	fullMsg := append([]byte(prefix), msgBytes...)
	hash := crypto.Keccak256(fullMsg)

	sigBytes, err := hexutil.Decode(signature)
	if err != nil || len(sigBytes) != 65 {
		return false
	}

	// Adjust recovery ID (v) from 27/28 to 0/1
	if sigBytes[64] == 27 || sigBytes[64] == 28 {
		sigBytes[64] -= 27
	}

	pubKey, err := crypto.SigToPub(hash, sigBytes)
	if err != nil {
		return false
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return strings.ToLower(recoveredAddr.Hex()) == strings.ToLower(walletAddress)
}

// WalletLogin handles Web3 signature verification and JWT issuance
func (hc *HandlerContext) WalletLogin(c *gin.Context) {
	var req WalletLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Web3 ECDSA signature
	if !VerifySignature(req.WalletAddress, req.Signature, req.Message) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Web3 cryptographic signature"})
		return
	}

	// Fallback to mock session if database is not active
	if hc.DB == nil {
		token, err := GenerateToken("a0000000-0000-0000-0000-000000000001", "", req.WalletAddress)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue session token"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":          token,
			"wallet_address": req.WalletAddress,
			"user_id":        "a0000000-0000-0000-0000-000000000001",
			"message":        "Wallet signature verified, mock login fallback successful",
		})
		return
	}

	ctx := context.Background()

	// Query database for user. If not exists, insert new record
	user, err := db.GetUserByWallet(ctx, hc.DB, req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database lookup failed"})
		return
	}

	var userID string
	if user == nil {
		// Create new profile with wallet address
		query := `INSERT INTO users (wallet_address, reputation_score) VALUES ($1, 0) RETURNING id`
		err = hc.DB.QueryRow(ctx, query, req.WalletAddress).Scan(&userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user record"})
			return
		}
	} else {
		userID = user.ID
	}

	// Generate JWT session token
	token, err := GenerateToken(userID, "", req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue session token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":          token,
		"wallet_address": req.WalletAddress,
		"user_id":        userID,
		"message":        "Wallet signature verified, login successful",
	})
}

// EmailLogin verifies email profile and issues login JWT (mock OTP)
func (hc *HandlerContext) EmailLogin(c *gin.Context) {
	var req EmailLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fallback to mock session if database is not active
	if hc.DB == nil {
		var mockUserID string
		if req.Email == "alice@proofpass.io" {
			mockUserID = "a0000000-0000-0000-0000-000000000001"
		} else if req.Email == "brian@proofpass.io" {
			mockUserID = "b0000000-0000-0000-0000-000000000002"
		} else {
			mockUserID = "c0000000-0000-0000-0000-000000000003"
		}

		token, err := GenerateToken(mockUserID, req.Email, "")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue login token"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":   token,
			"email":   req.Email,
			"user_id": mockUserID,
			"message": "Email login successful (mock OTP fallback)",
		})
		return
	}

	ctx := context.Background()

	// Query database for user. If not exists, insert new record
	user, err := db.GetUserByEmail(ctx, hc.DB, req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database lookup failed"})
		return
	}

	var userID string
	if user == nil {
		// Create new user profile with email address
		query := `INSERT INTO users (email, reputation_score) VALUES ($1, 0) RETURNING id`
		err = hc.DB.QueryRow(ctx, query, req.Email).Scan(&userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create email profile"})
			return
		}
	} else {
		userID = user.ID
	}

	token, err := GenerateToken(userID, req.Email, "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue login token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":   token,
		"email":   req.Email,
		"user_id": userID,
		"message": "Email login successful (mock OTP verification)",
	})
}
