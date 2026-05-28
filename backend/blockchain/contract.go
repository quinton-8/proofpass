package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
)

// ProofPassABI defines the Solidity contract methods we interact with.
const ProofPassABI = `[
	{
		"inputs": [
			{"internalType": "address", "name": "issuer", "type": "address"}
		],
		"name": "addIssuer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"internalType": "bytes32", "name": "id", "type": "bytes32"},
			{"internalType": "address", "name": "holder", "type": "address"},
			{"internalType": "bytes32", "name": "credHash", "type": "bytes32"}
		],
		"name": "issueCredential",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"internalType": "bytes32", "name": "id", "type": "bytes32"}
		],
		"name": "revokeCredential",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{"internalType": "bytes32", "name": "id", "type": "bytes32"}
		],
		"name": "verifyCredential",
		"outputs": [
			{"internalType": "address", "name": "issuer", "type": "address"},
			{"internalType": "address", "name": "holder", "type": "address"},
			{"internalType": "bytes32", "name": "credHash", "type": "bytes32"},
			{"internalType": "uint256", "name": "blockNumber", "type": "uint256"},
			{"internalType": "bool", "name": "isRevoked", "type": "bool"},
			{"internalType": "bool", "name": "exists", "type": "bool"}
		],
		"stateMutability": "view",
		"type": "function"
	}
]`

// getBoundContract helper initializes a BoundContract instance dynamically
func (bc *BlockchainClient) getBoundContract() (*bind.BoundContract, error) {
	parsedABI, err := abi.JSON(strings.NewReader(ProofPassABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse contract ABI: %w", err)
	}

	return bind.NewBoundContract(
		bc.ContractAddress,
		parsedABI,
		bc.Client,
		bc.Client,
		bc.Client,
	), nil
}

// AddIssuer registers a new authorized issuer address on-chain
func (bc *BlockchainClient) AddIssuer(ctx context.Context, issuerHex string) (string, error) {
	contract, err := bc.getBoundContract()
	if err != nil {
		return "", err
	}

	opts, err := bc.GetTransactOpts(ctx)
	if err != nil {
		return "", err
	}

	issuerAddr := common.HexToAddress(issuerHex)
	tx, err := contract.Transact(opts, "addIssuer", issuerAddr)
	if err != nil {
		return "", fmt.Errorf("failed to submit addIssuer tx: %w", err)
	}

	return tx.Hash().Hex(), nil
}

// IssueCredential writes a credential hash and holder binding to the smart contract
// It blocks until the transaction is mined and returns the TxHash and BlockNumber.
func (bc *BlockchainClient) IssueCredential(
	ctx context.Context, 
	idHex string, 
	holderHex string, 
	credHashHex string,
) (string, uint64, error) {
	contract, err := bc.getBoundContract()
	if err != nil {
		return "", 0, err
	}

	opts, err := bc.GetTransactOpts(ctx)
	if err != nil {
		return "", 0, err
	}

	id := [32]byte(common.HexToHash(idHex))
	holder := common.HexToAddress(holderHex)
	credHash := [32]byte(common.HexToHash(credHashHex))

	tx, err := contract.Transact(opts, "issueCredential", id, holder, credHash)
	if err != nil {
		return "", 0, fmt.Errorf("failed to submit issueCredential tx: %w", err)
	}

	// Wait for transaction confirmation
	receipt, err := bind.WaitMined(ctx, bc.Client, tx)
	if err != nil {
		return "", 0, fmt.Errorf("failed while waiting for tx confirmation: %w", err)
	}

	if receipt.Status == 0 {
		return "", 0, fmt.Errorf("transaction execution failed on-chain")
	}

	return tx.Hash().Hex(), receipt.BlockNumber.Uint64(), nil
}

// RevokeCredential invalidates a credential hash on-chain
func (bc *BlockchainClient) RevokeCredential(ctx context.Context, idHex string) (string, error) {
	contract, err := bc.getBoundContract()
	if err != nil {
		return "", err
	}

	opts, err := bc.GetTransactOpts(ctx)
	if err != nil {
		return "", err
	}

	id := [32]byte(common.HexToHash(idHex))
	tx, err := contract.Transact(opts, "revokeCredential", id)
	if err != nil {
		return "", fmt.Errorf("failed to submit revokeCredential tx: %w", err)
	}

	return tx.Hash().Hex(), nil
}

// VerifyCredential reads credential state from the ledger
func (bc *BlockchainClient) VerifyCredential(
	ctx context.Context, 
	idHex string,
) (
	issuer common.Address, 
	holder common.Address, 
	credHash [32]byte, 
	blockNumber *big.Int, 
	isRevoked bool, 
	exists bool, 
	err error,
) {
	contract, err := bc.getBoundContract()
	if err != nil {
		return common.Address{}, common.Address{}, [32]byte{}, nil, false, false, err
	}

	id := [32]byte(common.HexToHash(idHex))
	
	var results []interface{}

	err = contract.Call(&bind.CallOpts{Context: ctx}, &results, "verifyCredential", id)
	if err != nil {
		return common.Address{}, common.Address{}, [32]byte{}, nil, false, false, fmt.Errorf("verifyCredential call failed: %w", err)
	}

	if len(results) < 6 {
		return common.Address{}, common.Address{}, [32]byte{}, nil, false, false, fmt.Errorf("invalid result length: %d", len(results))
	}

	return results[0].(common.Address), results[1].(common.Address), results[2].([32]byte), results[3].(*big.Int), results[4].(bool), results[5].(bool), nil
}
