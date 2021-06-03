//SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract Common is Initializable, ContextUpgradeable, AccessControlUpgradeable {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    // Protocol parameters
    uint256 internal _protocolFee;
    uint256 internal _currentMetadataVersion;
    uint256 internal _minMetadataVersion;
    uint256 internal _maxAppreciation;
    uint256 internal _submissionDeposit;

    function __Common_init(
        uint256 protocolFee,
        uint256 minMetadataVersion,
        uint256 currentMetadataVersion,
        uint256 maxAppreciation,
        uint256 submissionDeposit
    ) internal initializer {
        __Common_init_unchained(
            protocolFee,
            minMetadataVersion,
            currentMetadataVersion,
            maxAppreciation,
            submissionDeposit
        );
    }

    function __Common_init_unchained(
        uint256 protocolFee,
        uint256 minMetadataVersion,
        uint256 currentMetadataVersion,
        uint256 maxAppreciation,
        uint256 submissionDeposit
    ) internal initializer {
        _protocolFee = protocolFee;
        _minMetadataVersion = minMetadataVersion;
        _currentMetadataVersion = currentMetadataVersion;
        _maxAppreciation = maxAppreciation;
        _submissionDeposit = submissionDeposit;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNOR_ROLE, _msgSender());
    }

    //
    // Modifiers
    //
    modifier isGovernor() {
        require(hasRole(GOVERNOR_ROLE, _msgSender()), "COMMON/CALLER_NOT_GOVERNOR");
        _;
    }

    //
    // Admin
    //
    function setProtocolFee(uint256 newValue) public isGovernor() {
        _protocolFee = newValue;
    }

    function setMinMetadataVersion(uint256 newValue) public isGovernor() {
        _minMetadataVersion = newValue;
    }

    function setCurrentMetadataVersion(uint256 newValue) public isGovernor() {
        _currentMetadataVersion = newValue;
    }

    function setMaxAppreciation(uint256 newValue) public isGovernor() {
        _maxAppreciation = newValue;
    }

    function setSubmissionDeposit(uint256 newValue) public isGovernor() {
        _submissionDeposit = newValue;
    }
}
