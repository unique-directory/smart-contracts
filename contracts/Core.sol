//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Core is ERC1155, AccessControl, ERC1155Pausable {
    using Counters for Counters.Counter;

    uint256 constant FUNGIBLE_TOKEN_ID = 1;
    uint256 constant UNIQUETTE_TOKENS_BASE = 999;

    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Submission {
        address submitter;
        uint256 price;
    }

    mapping(string => Submission) private submissions;
    mapping(uint => string) internal _idToIPFSHashMapping;

    event UniquetteSubmitted(address indexed submitter, string indexed ipfsHash, uint256 price);
    event UniquetteApproved(address indexed approver, address indexed submitter, string indexed ipfsHash, uint256 price, uint256 tokenId);
    event UniquetteRejected(address indexed approver, address indexed submitter, string indexed ipfsHash, uint256 price);

    string private _baseURI;
    address payable private _vault;
    address payable private _treasury;
    address payable private _approver;

    uint private _submissionPrize;

    Counters.Counter private _uniquetteNonce;

    constructor(
        string memory baseURI,
        string memory fungibleTokenMetadataIPFSHash,
        address payable vault,
        address payable treasury,
        address payable approver,
        uint submissionPrize
    ) ERC1155(baseURI) {
        _baseURI = baseURI;
        _vault = vault;
        _treasury = treasury;
        _approver = approver;
        _submissionPrize = submissionPrize;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(APPROVER_ROLE, approver);

        _idToIPFSHashMapping[FUNGIBLE_TOKEN_ID] = fungibleTokenMetadataIPFSHash;
    }

    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        return string(abi.encodePacked(_baseURI, _idToIPFSHashMapping[tokenId]));
    }

    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "must have pauser role");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "must have pauser role");
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
    internal virtual override(ERC1155, ERC1155Pausable)
    {
        // TODO make sure transaction is allowed and taxes are paid
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function submitUniquette(string calldata ipfsHash, uint256 price) public {
        require(submissions[ipfsHash].submitter == address(0), "already submitted");

        submissions[ipfsHash].submitter = _msgSender();
        submissions[ipfsHash].price = price;

        emit UniquetteSubmitted(_msgSender(), ipfsHash,  price);
    }

    function approveSubmission(string calldata ipfsHash) public {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(submissions[ipfsHash].submitter != address(0), "submission not found");

        _uniquetteNonce.increment();
        uint256 newTokenId = UNIQUETTE_TOKENS_BASE + _uniquetteNonce.current();

        _mint(
            _vault,
            newTokenId,
            1,
            bytes(ipfsHash)
        );
        _mint(
            submissions[ipfsHash].submitter,
            FUNGIBLE_TOKEN_ID,
            _submissionPrize,
            bytes(Strings.toString(newTokenId))
        );

        _idToIPFSHashMapping[newTokenId] = ipfsHash;

        emit UniquetteApproved(
            _msgSender(),
            submissions[ipfsHash].submitter,
            ipfsHash,
            submissions[ipfsHash].price,
            newTokenId
        );

        delete submissions[ipfsHash];
    }

    function rejectSubmission(string calldata ipfsHash) public {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(submissions[ipfsHash].submitter != address(0), "submission not found");

        address originalSubmitter = submissions[ipfsHash].submitter;
        uint256 originalPrice = submissions[ipfsHash].price;

        delete submissions[ipfsHash];

        emit UniquetteRejected(_msgSender(), originalSubmitter, ipfsHash, originalPrice);
    }
}
