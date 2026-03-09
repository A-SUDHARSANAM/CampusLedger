// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * CampusLedger — Immutable Asset Audit Trail
 *
 * Records every significant campus-asset lifecycle event on-chain:
 *   ASSET_CREATED · ASSET_UPDATED · ASSET_TRANSFERRED
 *   ASSET_REPAIRED · ASSET_DISPOSED · PROCUREMENT · MAINTENANCE
 *
 * Deploy to Polygon Mumbai testnet:
 *   npx hardhat run scripts/deploy.js --network mumbai
 */
contract CampusLedger {

    // ── Data ───────────────────────────────────────────────────────────────
    struct Block {
        uint256 blockIndex;
        string  assetId;
        string  assetName;
        string  action;
        string  performedBy;
        uint256 timestamp;
        bytes32 blockHash;
        bytes32 prevHash;
    }

    Block[]  public chain;
    uint256  public blockCount;

    // assetId → array of chain indices that concern this asset
    mapping(string => uint256[]) private assetHistory;

    // ── Events ─────────────────────────────────────────────────────────────
    event BlockAdded(
        uint256 indexed blockIndex,
        string  indexed assetId,
        string  action,
        string  performedBy,
        bytes32 blockHash
    );

    // ── Constructor: genesis block ─────────────────────────────────────────
    constructor() {
        bytes32 genesisHash = keccak256(abi.encodePacked(
            uint256(0), "GENESIS", "CampusLedger", "INIT", "system", block.timestamp, bytes32(0)
        ));
        chain.push(Block({
            blockIndex:  0,
            assetId:     "GENESIS",
            assetName:   "CampusLedger",
            action:      "CHAIN_INIT",
            performedBy: "system",
            timestamp:   block.timestamp,
            blockHash:   genesisHash,
            prevHash:    bytes32(0)
        }));
        blockCount = 1;
        emit BlockAdded(0, "GENESIS", "CHAIN_INIT", "system", genesisHash);
    }

    // ── Write ──────────────────────────────────────────────────────────────
    function addBlock(
        string memory _assetId,
        string memory _assetName,
        string memory _action,
        string memory _performedBy
    ) public returns (bytes32 newHash) {
        bytes32 prevHash = chain[blockCount - 1].blockHash;
        newHash = keccak256(abi.encodePacked(
            blockCount, _assetId, _assetName, _action, _performedBy, block.timestamp, prevHash
        ));

        chain.push(Block({
            blockIndex:  blockCount,
            assetId:     _assetId,
            assetName:   _assetName,
            action:      _action,
            performedBy: _performedBy,
            timestamp:   block.timestamp,
            blockHash:   newHash,
            prevHash:    prevHash
        }));

        assetHistory[_assetId].push(blockCount);
        blockCount++;

        emit BlockAdded(blockCount - 1, _assetId, _action, _performedBy, newHash);
    }

    // ── Read ───────────────────────────────────────────────────────────────
    function getBlock(uint256 index)
        public view
        returns (
            uint256 blockIndex_,
            string memory assetId,
            string memory assetName,
            string memory action,
            string memory performedBy,
            uint256 timestamp,
            bytes32 blockHash,
            bytes32 prevHash
        )
    {
        require(index < blockCount, "Index out of range");
        Block memory b = chain[index];
        return (b.blockIndex, b.assetId, b.assetName, b.action, b.performedBy, b.timestamp, b.blockHash, b.prevHash);
    }

    function getAssetHistory(string memory _assetId)
        public view returns (uint256[] memory)
    {
        return assetHistory[_assetId];
    }

    function verifyChain() public view returns (bool intact) {
        for (uint256 i = 1; i < blockCount; i++) {
            bytes32 expected = keccak256(abi.encodePacked(
                chain[i].blockIndex,
                chain[i].assetId,
                chain[i].assetName,
                chain[i].action,
                chain[i].performedBy,
                chain[i].timestamp,
                chain[i].prevHash
            ));
            if (expected != chain[i].blockHash) return false;
            if (chain[i].prevHash != chain[i - 1].blockHash) return false;
        }
        return true;
    }
}
