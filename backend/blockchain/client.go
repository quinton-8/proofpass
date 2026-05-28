package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// BlockchainClient coordinates all interactions with the Polygon network
type BlockchainClient struct {
	Client          *ethclient.Client
	ContractAddress common.Address
	PrivateKey      *ecdsa.PrivateKey
	ChainID         *big.Int
}

// NewBlockchainClient initializes the JSON-RPC ethclient and loads the signer key
func NewBlockchainClient(rpcURL, contractAddrHex, privateKeyHex string) (*BlockchainClient, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC node: %w", err)
	}

	contractAddress := common.HexToAddress(contractAddrHex)

	var privateKey *ecdsa.PrivateKey
	if privateKeyHex != "" {
		privateKey, err = crypto.HexToECDSA(privateKeyHex)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
	}

	ctx := context.Background()
	chainID, err := client.ChainID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch chain ID: %w", err)
	}

	return &BlockchainClient{
		Client:          client,
		ContractAddress: contractAddress,
		PrivateKey:      privateKey,
		ChainID:         chainID,
	}, nil
}

// GetTransactOpts constructs transaction options for state-changing writes
func (bc *BlockchainClient) GetTransactOpts(ctx context.Context) (*bind.TransactOpts, error) {
	if bc.PrivateKey == nil {
		return nil, fmt.Errorf("private key is required for state-changing transactions")
	}

	fromAddress := crypto.PubkeyToAddress(bc.PrivateKey.PublicKey)
	nonce, err := bc.Client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve account nonce: %w", err)
	}

	gasPrice, err := bc.Client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to suggest gas price: %w", err)
	}

	// Add 10% gas price buffer for Polygon network volatility
	gasPriceBuffer := new(big.Int).Div(gasPrice, big.NewInt(10))
	gasPrice.Add(gasPrice, gasPriceBuffer)

	auth, err := bind.NewKeyedTransactorWithChainID(bc.PrivateKey, bc.ChainID)
	if err != nil {
		return nil, fmt.Errorf("failed to create transactor: %w", err)
	}

	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)     // no ether sent
	auth.GasLimit = uint64(300000) // generous cap for basic contract writes
	auth.GasPrice = gasPrice

	return auth, nil
}
