package handlers

import (
	"context"
	"net/http"

	"backend/db"

	"github.com/gin-gonic/gin"
)

// GetTeams handles retrieving team lists and contribution score bars from the DB
func (hc *HandlerContext) GetTeams(c *gin.Context) {
	// Fallback to mock teams if database is not active
	if hc.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"teams": []gin.H{
				{
					"id":          "d0000000-0000-0000-0000-000000000001",
					"name":        "Clairvoyance Core",
					"description": "Core development team building ProofPass decentralized verification.",
					"members": []gin.H{
						{
							"id":              "a0000000-0000-0000-0000-000000000001",
							"name":            "Alice Wanjiku",
							"role":            "Solidity Developer",
							"github_username": "alice-wanjiku",
							"reputation":      95,
						},
						{
							"id":              "b0000000-0000-0000-0000-000000000002",
							"name":            "Brian",
							"role":            "Go Backend Engineer",
							"github_username": "brian-go",
							"reputation":      80,
						},
						{
							"id":              "c0000000-0000-0000-0000-000000000003",
							"name":            "Carol",
							"role":            "UI/UX Designer",
							"github_username": "carol-ux",
							"reputation":      85,
						},
					},
				},
			},
		})
		return
	}

	ctx := context.Background()

	teams, err := db.GetTeamsWithMembers(ctx, hc.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch team list from database"})
		return
	}

	if teams == nil {
		c.JSON(http.StatusOK, gin.H{"teams": []db.Team{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"teams": teams,
	})
}
