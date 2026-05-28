// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProofPass {
    address public owner;

    struct Credential {
        address issuer;
        address holder;
        bytes32 credHash;
        uint256 blockNumber;
        bool isRevoked;
        bool exists;
    }

    // Mapping from credential ID to Credential details
    mapping(bytes32 => Credential) private credentials;
    // Mapping of authorized issuers
    mapping(address => bool) public issuers;

    event CredentialIssued(
        bytes32 indexed id,
        address indexed issuer,
        address indexed holder,
        bytes32 credHash
    );
    event CredentialRevoked(bytes32 indexed id, address indexed revoker);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyIssuer() {
        require(issuers[msg.sender] || msg.sender == owner, "Only authorized issuers can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true;
        emit IssuerAdded(msg.sender);
    }

    /**
     * @notice Add a new authorized issuer
     * @param issuer The address of the new issuer
     */
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid issuer address");
        require(!issuers[issuer], "Already an issuer");
        issuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /**
     * @notice Remove an authorized issuer
     * @param issuer The address of the issuer to remove
     */
    function removeIssuer(address issuer) external onlyOwner {
        require(issuers[issuer], "Not an issuer");
        issuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /**
     * @notice Issue a new credential
     * @param id Unique identifier (hash) of the credential
     * @param holder The address of the credential holder
     * @param credHash The cryptographic hash of the credential data
     */
    function issueCredential(
        bytes32 id,
        address holder,
        bytes32 credHash
    ) external onlyIssuer {
        require(id != bytes32(0), "Invalid credential ID");
        require(holder != address(0), "Invalid holder address");
        require(credHash != bytes32(0), "Invalid credential hash");
        require(!credentials[id].exists, "Credential already exists");

        credentials[id] = Credential({
            issuer: msg.sender,
            holder: holder,
            credHash: credHash,
            blockNumber: block.number,
            isRevoked: false,
            exists: true
        });

        emit CredentialIssued(id, msg.sender, holder, credHash);
    }

    /**
     * @notice Revoke an existing credential
     * @param id Unique identifier of the credential to revoke
     */
    function revokeCredential(bytes32 id) external onlyIssuer {
        require(credentials[id].exists, "Credential does not exist");
        require(!credentials[id].isRevoked, "Credential already revoked");
        
        // Only the issuer of this credential or the owner can revoke it
        require(
            credentials[id].issuer == msg.sender || msg.sender == owner,
            "Not authorized to revoke this credential"
        );

        credentials[id].isRevoked = true;
        emit CredentialRevoked(id, msg.sender);
    }

    /**
     * @notice Verify a credential's status and details
     * @param id Unique identifier of the credential to verify
     */
    function verifyCredential(
        bytes32 id
    )
        external
        view
        returns (
            address issuer,
            address holder,
            bytes32 credHash,
            uint256 blockNumber,
            bool isRevoked,
            bool exists
        )
    {
        Credential memory cred = credentials[id];
        return (
            cred.issuer,
            cred.holder,
            cred.credHash,
            cred.blockNumber,
            cred.isRevoked,
            cred.exists
        );
    }
}
