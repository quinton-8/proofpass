package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"backend/db"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type IssueCredentialRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	HolderEmail string `json:"holder_email" binding:"required,email"`
}

// IssueCredential handles the end-to-end credential issuance workflow:
// Computes metadata hash -> Writes to Polygon Amoy -> Records in Supabase DB
func (hc *HandlerContext) IssueCredential(c *gin.Context) {
	var req IssueCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	issuerID := c.GetString("user_id")
	ctx := context.Background()

	// Fallback to mock issuance if database is not active
	if hc.DB == nil {
		mockID := "f0000000-0000-0000-0000-000000000001"
		mockHash := "0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000"
		mockTx := "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
		c.JSON(http.StatusCreated, gin.H{
			"message":       "Credential successfully issued (mock backend fallback)",
			"credential_id": mockID,
			"hash":          mockHash,
			"tx_hash":       mockTx,
			"block_number":  4823901,
		})
		return
	}

	// 1. Resolve or create the holder by email address
	holder, err := db.GetUserByEmail(ctx, hc.DB, req.HolderEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed holder profile lookup"})
		return
	}

	var holderID string
	var holderWallet string
	if holder == nil {
		// Auto-register holder profile
		query := `INSERT INTO users (email, reputation_score) VALUES ($1, 5) RETURNING id`
		err = hc.DB.QueryRow(ctx, query, req.HolderEmail).Scan(&holderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register holder profile"})
			return
		}
		// Fallback wallet address for blockchain registration
		holderWallet = "0x1111111111111111111111111111111111111111"
	} else {
		holderID = holder.ID
		if holder.WalletAddress != nil {
			holderWallet = *holder.WalletAddress
		} else {
			holderWallet = "0x1111111111111111111111111111111111111111"
		}
	}

	// 2. Generate unique credential ID (UUID)
	credID := uuid.New().String()

	// 3. Compute cryptographic metadata SHA256/Keccak hash
	rawText := fmt.Sprintf("%s:%s:%s", credID, req.HolderEmail, req.Title)
	hashBytes := crypto.Keccak256([]byte(rawText))
	hashHex := hexutil.Encode(hashBytes)

	// 4. Publish transaction on Polygon Amoy Ledger
	txHash, blockNum, err := hc.BC.IssueCredential(ctx, credID, holderWallet, hashHex)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Blockchain transaction failed: %v", err)})
		return
	}

	// 5. Save the local ledger copy in PostgreSQL
	blockInt := int64(blockNum)
	cred := &db.Credential{
		ID:          credID,
		Title:       req.Title,
		Description: req.Description,
		Hash:        hashHex,
		TxHash:      &txHash,
		BlockNumber: &blockInt,
		IssuerID:    &issuerID,
		HolderID:    &holderID,
		Status:      "active",
	}

	err = db.CreateCredential(ctx, hc.DB, cred)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to store database record: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":       "Credential successfully issued on-chain and cached",
		"credential_id": credID,
		"hash":          hashHex,
		"tx_hash":       txHash,
		"block_number":  blockNum,
	})
}

// VerifyCredential performs a dual verify: DB metadata lookup + live Polygon Amoy check
func (hc *HandlerContext) VerifyCredential(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()

	// Fallback to mock verification if database is not active
	if hc.DB == nil {
		if id == "f0000000-0000-0000-0000-000000000001" || id == "cred_alice" {
			c.JSON(http.StatusOK, gin.H{
				"status":       "verified",
				"title":        "Solidity Developer Credential",
				"description":  "Alice Wanjiku - Solidity Developer - Kenyatta University",
				"holder_name":  "Alice Wanjiku",
				"issuer_name":  "Brian (ProofPass Core)",
				"hash":         "0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000",
				"tx_hash":      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				"block_number": 4823901,
			})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "not_found",
			"message": "Credential not found (mock backend fallback)",
		})
		return
	}

	// 1. Fetch metadata record cache from Database
	cred, err := db.GetCredentialByID(ctx, hc.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed cache retrieval"})
		return
	}
	if cred == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "not_found",
			"message": "Credential not found in database registry",
		})
		return
	}

	// 2. Fetch live blockchain state directly from the deployed Polygon Amoy contract
	onChainIssuer, onChainHolder, onChainHash, onChainBlock, isRevoked, exists, err := hc.BC.VerifyCredential(ctx, id)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Blockchain network verify call failed: %v", err)})
		return
	}

	// State 1: Credential does not exist on-chain
	if !exists {
		c.JSON(http.StatusOK, gin.H{
			"status":  "not_found",
			"message": "Credential not registered in blockchain ledger",
		})
		return
	}

	// State 2: Credential has been revoked on-chain
	if isRevoked {
		c.JSON(http.StatusOK, gin.H{
			"status":  "tampered",
			"message": "Credential was revoked by the authorized issuer",
		})
		return
	}

	// State 3: Cryptographic hash mismatch (Tampered metadata)
	computedHashHex := hexutil.Encode(onChainHash[:])
	if strings.ToLower(computedHashHex) != strings.ToLower(cred.Hash) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "tampered",
			"message": "Cryptographic payload mismatch. Metadata has been modified.",
		})
		return
	}

	// State 4: Verified match
	c.JSON(http.StatusOK, gin.H{
		"status":          "verified",
		"title":           cred.Title,
		"description":     cred.Description,
		"holder_name":     cred.HolderName,
		"issuer_name":     cred.IssuerName,
		"hash":            cred.Hash,
		"tx_hash":         cred.TxHash,
		"block_number":    onChainBlock.Uint64(),
		"blockchain_info": gin.H{
			"issuer_address": onChainIssuer.Hex(),
			"holder_address": onChainHolder.Hex(),
		},
	})
}

// GetMyCredentials lists credentials belonging to the logged-in holder user
func (hc *HandlerContext) GetMyCredentials(c *gin.Context) {
	userID := c.GetString("user_id")
	ctx := context.Background()

	// Fallback to mock credentials if database is not active
	if hc.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"credentials": []gin.H{
				{
					"id":           "f0000000-0000-0000-0000-000000000001",
					"title":        "Solidity Developer Credential",
					"description":  "Alice Wanjiku - Solidity Developer - Kenyatta University",
					"hash":         "0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000",
					"tx_hash":      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					"block_number": 4823901,
					"status":       "active",
				},
			},
		})
		return
	}

	credentials, err := db.GetCredentialsByHolder(ctx, hc.DB, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credentials list"})
		return
	}

	if credentials == nil {
		c.JSON(http.StatusOK, gin.H{"credentials": []db.Credential{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"credentials": credentials,
	})
}

// GetPortfolio returns public profile info and list of credentials for a given user slug
func (hc *HandlerContext) GetPortfolio(c *gin.Context) {
	slug := c.Param("slug")
	ctx := context.Background()

	// Fallback to mock portfolio if database is not active
	if hc.DB == nil {
		if slug == "alice" || slug == "alice-wanjiku" {
			c.JSON(http.StatusOK, gin.H{
				"user": gin.H{
					"name":            "Alice Wanjiku",
					"reputation":      95,
					"github_username": "alice-wanjiku",
					"email":           "alice@proofpass.io",
					"wallet_address":  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
				},
				"credentials": []gin.H{
					{
						"id":           "f0000000-0000-0000-0000-000000000001",
						"title":        "Solidity Developer Credential",
						"description":  "Alice Wanjiku - Solidity Developer - Kenyatta University",
						"hash":         "0x4e082c161eb3a010c7d01b50e0d17dc79c8823901b0000000000000000000000",
						"tx_hash":      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
						"block_number": 4823901,
						"status":       "active",
					},
				},
			})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Portfolio not found (mock backend fallback)"})
		return
	}

	// 1. Fetch user by slug
	user, err := db.GetUserBySlug(ctx, hc.DB, slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed profile lookup"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Portfolio user profile not found"})
		return
	}

	// 2. Fetch credentials for that user
	credentials, err := db.GetCredentialsByHolder(ctx, hc.DB, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credentials list"})
		return
	}

	if credentials == nil {
		credentials = []db.Credential{}
	}

	// Derive display name
	displayName := ""
	if user.GithubUsername != nil && *user.GithubUsername != "" {
		displayName = *user.GithubUsername
	} else if user.Email != nil {
		displayName = strings.Split(*user.Email, "@")[0]
	} else {
		displayName = "User"
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"name":            displayName,
			"reputation":      user.ReputationScore,
			"github_username": user.GithubUsername,
			"email":           user.Email,
			"wallet_address":  user.WalletAddress,
		},
		"credentials": credentials,
	})
}

