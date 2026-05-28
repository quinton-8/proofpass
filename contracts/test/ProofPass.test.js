const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProofPass Smart Contract", function () {
  let proofPass;
  let owner;
  let issuer;
  let holder;
  let other;

  // Helpers to generate bytes32
  const credId = ethers.keccak256(ethers.toUtf8Bytes("cred-123"));
  const credHash = ethers.keccak256(ethers.toUtf8Bytes("credential-metadata-json-string"));

  beforeEach(async function () {
    [owner, issuer, holder, other] = await ethers.getSigners();
    const ProofPassFactory = await ethers.getContractFactory("ProofPass");
    proofPass = await ProofPassFactory.deploy();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await proofPass.owner()).to.equal(owner.address);
    });

    it("Should make the owner an issuer by default", async function () {
      expect(await proofPass.issuers(owner.address)).to.be.true;
    });
  });

  describe("Issuer Management", function () {
    it("Should allow owner to add a new issuer", async function () {
      await expect(proofPass.connect(owner).addIssuer(issuer.address))
        .to.emit(proofPass, "IssuerAdded")
        .withArgs(issuer.address);

      expect(await proofPass.issuers(issuer.address)).to.be.true;
    });

    it("Should prevent non-owners from adding a new issuer", async function () {
      await expect(
        proofPass.connect(other).addIssuer(issuer.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to remove an issuer", async function () {
      await proofPass.connect(owner).addIssuer(issuer.address);
      await expect(proofPass.connect(owner).removeIssuer(issuer.address))
        .to.emit(proofPass, "IssuerRemoved")
        .withArgs(issuer.address);

      expect(await proofPass.issuers(issuer.address)).to.be.false;
    });
  });

  describe("Credential Issuance", function () {
    beforeEach(async function () {
      await proofPass.connect(owner).addIssuer(issuer.address);
    });

    it("Should allow an authorized issuer to issue a credential", async function () {
      await expect(
        proofPass.connect(issuer).issueCredential(credId, holder.address, credHash)
      )
        .to.emit(proofPass, "CredentialIssued")
        .withArgs(credId, issuer.address, holder.address, credHash);

      const result = await proofPass.verifyCredential(credId);
      expect(result.issuer).to.equal(issuer.address);
      expect(result.holder).to.equal(holder.address);
      expect(result.credHash).to.equal(credHash);
      expect(result.isRevoked).to.be.false;
      expect(result.exists).to.be.true;
    });

    it("Should prevent non-issuers from issuing a credential", async function () {
      await expect(
        proofPass.connect(other).issueCredential(credId, holder.address, credHash)
      ).to.be.revertedWith("Only authorized issuers can call this function");
    });

    it("Should prevent double issuance of the same credential ID", async function () {
      await proofPass.connect(issuer).issueCredential(credId, holder.address, credHash);
      await expect(
        proofPass.connect(issuer).issueCredential(credId, holder.address, credHash)
      ).to.be.revertedWith("Credential already exists");
    });
  });

  describe("Credential Revocation", function () {
    beforeEach(async function () {
      await proofPass.connect(owner).addIssuer(issuer.address);
      await proofPass.connect(issuer).issueCredential(credId, holder.address, credHash);
    });

    it("Should allow issuer of the credential to revoke it", async function () {
      await expect(proofPass.connect(issuer).revokeCredential(credId))
        .to.emit(proofPass, "CredentialRevoked")
        .withArgs(credId, issuer.address);

      const result = await proofPass.verifyCredential(credId);
      expect(result.isRevoked).to.be.true;
    });

    it("Should allow owner to revoke a credential issued by someone else", async function () {
      await expect(proofPass.connect(owner).revokeCredential(credId))
        .to.emit(proofPass, "CredentialRevoked")
        .withArgs(credId, owner.address);

      const result = await proofPass.verifyCredential(credId);
      expect(result.isRevoked).to.be.true;
    });

    it("Should prevent unauthorized users from revoking a credential", async function () {
      await expect(
        proofPass.connect(other).revokeCredential(credId)
      ).to.be.revertedWith("Not authorized to revoke this credential");
    });
  });
});
