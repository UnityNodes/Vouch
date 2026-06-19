// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ComplianceGateway
 * @notice On-chain pointer for every compliance decision. The full decision
 *         record (LLM prompt, verdict, attestation headers) lives on 0G
 *         Storage; on-chain we only keep a 32-byte root hash + the boolean
 *         outcome. Cheap to write, auditable forever.
 *
 *         Group-stage: anyone can call recordDecision (demo simplicity). In
 *         Ro32 this grows into a per-agent policy registry — the same contract
 *         will also hold `mapping(address agent => Policy)` so the off-chain
 *         LLM judges against on-chain rules.
 */
contract ComplianceGateway {
    event DecisionRecorded(
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        bytes32 indexed decisionHash,
        bytes32 storageRoot,
        bool allowed
    );

    /// @notice decisionHash → 0G Storage root holding the full record blob.
    mapping(bytes32 => bytes32) public storageRootOf;

    /// @notice decisionHash → allowed bit (compact retrospective queries).
    mapping(bytes32 => bool) public allowedOf;

    function recordDecision(
        address payer,
        address merchant,
        uint256 amount,
        bytes32 decisionHash,
        bytes32 storageRoot,
        bool allowed
    ) external {
        storageRootOf[decisionHash] = storageRoot;
        allowedOf[decisionHash] = allowed;
        emit DecisionRecorded(payer, merchant, amount, decisionHash, storageRoot, allowed);
    }
}
