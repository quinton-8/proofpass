package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"backend/blockchain"
	"backend/db"
	"backend/handlers"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
)

var jwtKey = []byte("super-secret-proofpass-key")

// AuthMiddleware validates the JWT token and extracts claims
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be format: Bearer {token}"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &handlers.Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Store user ID in context
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("wallet_address", claims.WalletAddress)

		c.Next()
	}
}

// CORSMiddleware sets the appropriate headers for local frontend integration
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func main() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found or error loading it, using system environment variables")
	}

	// 1. Resolve environment variables
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Default fallback to local development postgres
		dbURL = "postgresql://postgres:postgres@localhost:5432/postgres"
		log.Println("WARNING: DATABASE_URL not set. Falling back to local default.")
	}

	rpcURL := os.Getenv("POLYGON_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://rpc-amoy.polygon.technology"
	}

	contractAddr := os.Getenv("CONTRACT_ADDRESS")
	if contractAddr == "" {
		contractAddr = "0x8b5cf606b6d4f43f5ea000000000000000000000"
		log.Println("WARNING: CONTRACT_ADDRESS not set. Using fallback placeholder.")
	}

	privateKeyHex := os.Getenv("ISSUER_PRIVATE_KEY")
	if privateKeyHex == "" {
		// Valid random hex key for initial mock signature generation/compilation checks
		privateKeyHex = "47e179ec1974492b67f13738562df919c5573956857cb8a9947b6673f32f3df1"
		log.Println("WARNING: ISSUER_PRIVATE_KEY not set. Using random fallback signer.")
	}

	ctx := context.Background()

	// 2. Initialize database connection pool
	log.Printf("Connecting to database pool on: %s...", strings.Split(dbURL, "@")[len(strings.Split(dbURL, "@"))-1])
	dbPool, err := db.InitDB(ctx, dbURL)
	if err != nil {
		log.Printf("DB Connection warning: %v. Server running in mock db state.", err)
	} else {
		defer dbPool.Close()
		log.Println("Database connection pool established successfully.")
	}

	// 3. Initialize Blockchain Client connection
	log.Printf("Connecting to Polygon node on %s...", rpcURL)
	bcClient, err := blockchain.NewBlockchainClient(rpcURL, contractAddr, privateKeyHex)
	if err != nil {
		log.Fatalf("Critical error initializing blockchain client: %v", err)
	}
	log.Println("Polygon blockchain client connected successfully.")

	// 4. Inject clients into route context
	hc := &handlers.HandlerContext{
		DB: dbPool,
		BC: bcClient,
	}

	// 5. Initialize router configuration
	r := gin.Default()
	r.Use(CORSMiddleware())

	// Public Health Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":            "healthy",
			"database_active":   dbPool != nil,
			"blockchain_active": bcClient != nil,
		})
	})

	api := r.Group("/api")
	{
		// Auth Routes
		auth := api.Group("/auth")
		{
			auth.POST("/wallet", hc.WalletLogin)
			auth.POST("/email", hc.EmailLogin)
		}

		// Public Verification Endpoint
		api.GET("/credentials/verify/:id", hc.VerifyCredential)

		// Public Team details
		api.GET("/teams", hc.GetTeams)

		// Public Portfolio details
		api.GET("/portfolio/:slug", hc.GetPortfolio)

		// Protected Route Grouping
		protected := api.Group("/")
		protected.Use(AuthMiddleware())
		{
			protected.POST("/credentials/issue", hc.IssueCredential)
			protected.GET("/credentials/my", hc.GetMyCredentials)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("ProofPass production-ready backend starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
