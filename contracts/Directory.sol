//SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import "hardhat/console.sol";

import "./Submissions.sol";
import "./Uniquettes.sol";

contract Directory is ContextUpgradeable, Common, Submissions, Uniquettes {
    event SubmissionFunded(
        address indexed operator,
        address indexed collector,
        uint256 indexed tokenId,
        string submissionHash,
        uint256 appreciatedPrice,
        uint256 payment
    );

    mapping(uint256 => string) internal _fundedSubmissionHashByUniquetteTokenId;

    Vault private _vault;
    string private _tokensBaseURI;

    function initialize(
        string memory name,
        string memory symbol,
        string memory tokensBaseURI,
        address token,
        address payable vault,
        address payable treasury,
        address payable marketer,
        uint256 protocolFee,
        uint256 minMetadataVersion,
        uint256 currentMetadataVersion,
        uint256 maxAppreciation,
        uint256 submissionDeposit
    ) public initializer {
        __Common_init_unchained(
            protocolFee,
            minMetadataVersion,
            currentMetadataVersion,
            maxAppreciation,
            submissionDeposit
        );
        __Uniquettes_init_unchained(name, symbol, token, vault, treasury, marketer);
        __Submissions_init_unchained(treasury);

        _vault = Vault(vault);
        _tokensBaseURI = tokensBaseURI;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNOR_ROLE, _msgSender());
    }

    //
    // Overrides
    //
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, Submissions, Uniquettes)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    //
    // Customized ERC-721 functions
    //
    function tokenURI(uint256 tokenId) public view virtual override tokenExists(tokenId) returns (string memory) {
        return string(abi.encodePacked(_tokensBaseURI, _fundedSubmissionHashByUniquetteTokenId[tokenId]));
    }

    function setTreasuryAddress(address payable newAddress) public override(Uniquettes, Submissions) isGovernor() {
        Uniquettes.setTreasuryAddress(newAddress);
        Submissions.setTreasuryAddress(newAddress);
    }

    //
    // Unique Directory functions
    //
    function getParameters()
        public
        view
        virtual
        returns (
            uint256 protocolFee,
            uint256 currentMetadataVersion,
            uint256 minMetadataVersion,
            uint256 maxAppreciation,
            uint256 submissionDeposit
        )
    {
        return (_protocolFee, _currentMetadataVersion, _minMetadataVersion, _maxAppreciation, _submissionDeposit);
    }

    // We must mint a new ERC-721 token for approved submission for a new Uniquette
    function _afterSubmissionApprove(string memory hash) internal virtual override(Submissions) {
        if (_submissions[hash].tokenId > 0) {
            // Skip if there is already a Uniquette for this submission.
            return;
        }

        require(_submissions[hash].status == SubmissionStatus.Approved, "DIRECTORY/SUBMISSION_NOT_APPROVED");

        // Mint the new uniquette into Vault
        uint256 newTokenId = uniquetteMint();

        // Update submission with the new token ID
        _submissions[hash].tokenId = newTokenId;
    }

    function fund(
        address to,
        uint256 tokenId,
        string calldata submissionHash
    )
        public
        payable
        virtual
        tokenExists(tokenId)
        submissionExists(submissionHash)
        submissionIsApproved(submissionHash)
        submissionIsUpToDate(submissionHash)
        nonReentrant
    {
        Submission memory submission = submissionGetByHash(submissionHash);
        address operator = _msgSender();

        require(submission.tokenId == tokenId, "DIRECTORY/INVALID_SUBMISSION_FOR_UNIQUETTE");

        _fundedSubmissionHashByUniquetteTokenId[tokenId] = submissionHash;

        {
            uint256 appreciatedPrice;
            (, appreciatedPrice, , ) = uniquetteTakeOver(operator, to, tokenId, submission.addedValue);

            emit SubmissionFunded(operator, to, tokenId, submissionHash, appreciatedPrice, msg.value);
        }
    }

    function collect(address to, uint256 tokenId) public payable virtual tokenExists(tokenId) nonReentrant {
        require(
            bytes(_fundedSubmissionHashByUniquetteTokenId[tokenId]).length > 0,
            "DIRECTORY/NO_SUBMISSION_FUNDED_FOR_UNIQUETTE"
        );

        uniquetteTakeOver(_msgSender(), to, tokenId, 0);
    }
}
