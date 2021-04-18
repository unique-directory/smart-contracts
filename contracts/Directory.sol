//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./Common.sol";
import "./Token.sol";
import "./Vault.sol";
import "./Treasury.sol";

contract Directory is Context, AccessControlEnumerable, ERC721Enumerable, ERC721Pausable, ReentrancyGuard {
    using Address for address;
    using Counters for Counters.Counter;

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum UniquetteStatus { PendingApproval, PendingUpgrade, Approved }

    struct Uniquette {
        address author;
        address owner;
        uint256 collateralValue;
        uint256 lastPurchaseAmount;
        uint256 salePrice;
        bool initialSale;
        uint256 metadataVersion;
        uint256 tokenId;
        UniquetteStatus status;
    }

    event UniquetteSubmitted(address indexed submitter, string indexed hash);
    event UniquetteApproved(address approver, address indexed submitter, string indexed hash, uint256 indexed tokenId);
    event UniquetteRejected(address approver, address indexed submitter, string indexed hash);
    event UniquetteBought(address operator, address indexed seller, address indexed buyer, uint256 indexed tokenId);
    event ProtocolFeePaid(address indexed operator, address seller, address indexed buyer, uint256 indexed tokenId, uint256 feePaid);
    event CollateralIncreased(address indexed operator, address seller, address indexed buyer, uint256 indexed tokenId, uint256 additionalCollateral);
    event PutForSale(address indexed operator, address indexed seller, uint256 indexed tokenId, string hash, uint256 price);
    event TakeOffFromSale(address indexed operator, address indexed seller, uint256 indexed tokenId, string hash);

    string private _tokensBaseURI;
    Token private _token;
    Vault private _vault;
    Treasury private _treasury;
    address payable private _approver;
    address payable private _marketer;

    uint256 private _initialUniquettePrice;
    uint256 private _originalAuthorShare;
    uint256 private _protocolFee;
    uint256 private _submissionPrize;
    uint256 private _currentMetadataVersion;
    uint256 private _minMetadataVersion;
    uint256 private _maxPriceIncrease;

    mapping(uint256 => string) internal _idToHashMapping;
    mapping(string => Uniquette) internal _uniquettes;

    Counters.Counter private _tokenIdTracker;

    constructor(
        string memory name,
        string memory symbol,
        string memory tokensBaseURI,
        address payable token,
        address payable vault,
        address payable treasury,
        address payable approver,
        address payable marketer,
        uint256[7] memory uints
    ) ERC721(name, symbol) {
        _tokensBaseURI = tokensBaseURI;
        _token = Token(token);
        _vault = Vault(vault);
        _treasury = Treasury(treasury);
        _approver = approver;
        _marketer = marketer;

        _initialUniquettePrice = uints[0];
        _originalAuthorShare = uints[1];
        _protocolFee = uints[2];
        _submissionPrize  = uints[3];
        _currentMetadataVersion  = uints[4];
        _minMetadataVersion  = uints[5];
        _maxPriceIncrease  = uints[6];

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(APPROVER_ROLE, approver);
    }

    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "must have pauser role");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "must have pauser role");
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerable, ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Customized ERC-721 functions:
    //      1. To generated metadata URI based on baseURI + hash of a uniquette.
    //      2. To return supply for both fungible and uniquette tokens (always 1).
    //      3. To only allow burning of fungible tokens by users and still allow governance to burn a uniquette.
    //      4. To allow Marketer contract to sell uniquettes on exchanges on behalf of the owners.
    //      5. To allow transfers only via buying mechanism or by trusted Marketer contract.
    //
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        return string(abi.encodePacked(_tokensBaseURI, _idToHashMapping[tokenId]));
    }

    function burn(uint256 tokenId) public virtual {
        require(
            hasRole(GOVERNANCE_ROLE, _msgSender()),
            "ERC721Burnable: only governance can burn uniquettes"
        );

        _burn(tokenId);
    }

    function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
        return (
            // Transfers must be either operated by marketer contract (when selling on a DEX)
            operator == _marketer ||
            // or, operated by approver contract (when approving a submission)
            operator == _approver ||
            // or, operator is temporarily approved during buy operation
            super.isApprovedForAll(account, operator)
        );
    }

    // We need to override to remove "orOwner" since we should not allow transfers initiated directly by owners
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual override returns (bool) {
        require(_exists(tokenId), "Directory: operator query for nonexistent token");
        address owner = ERC721.ownerOf(tokenId);
        return (getApproved(tokenId) == spender || ERC721.isApprovedForAll(owner, spender));
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual override(ERC721Enumerable, ERC721Pausable) {
        _uniquettes[_idToHashMapping[tokenId]].owner = to;
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) public virtual override {
        revert("Directory: approve not supported on uniquette transfers");
    }

    //
    // Unique directory functions
    //
    function uniquetteHashById(uint256 tokenId) public view virtual returns (string memory) {
        require(_exists(tokenId), "Directory: query for nonexistent token");
        require(_uniquettes[_idToHashMapping[tokenId]].author != address(0), "Directory: uniquette not found");

        return _idToHashMapping[tokenId];
    }

    function uniquetteGetByHash(string calldata hash) public view virtual returns (Uniquette memory) {
        require(_uniquettes[hash].author != address(0), "Directory: uniquette not found");

        return _uniquettes[hash];
    }

    function uniquetteSubmit(string calldata hash) public nonReentrant {
        require(_uniquettes[hash].author == address(0), "already submitted");

        _uniquettes[hash].author = _msgSender();
        _uniquettes[hash].status = UniquetteStatus.PendingApproval;

        emit UniquetteSubmitted(_msgSender(), hash);
    }

    function uniquetteApprove(string calldata hash) public nonReentrant {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(_uniquettes[hash].author != address(0), "submission not found");
        require(_uniquettes[hash].status == UniquetteStatus.PendingApproval, "submission not pending approval");

        _tokenIdTracker.increment();
        uint256 newTokenId = _tokenIdTracker.current();

        // Send the new uniquette to Vault
        _mint(address(_vault), newTokenId);

        // Compensate original author for their submission with ERC-20 tokens
        _token.mint(
            _uniquettes[hash].author,
            _submissionPrize
        );

        _idToHashMapping[newTokenId] = hash;
        _uniquettes[hash].owner = address(_vault);
        _uniquettes[hash].tokenId = newTokenId;
        _uniquettes[hash].status = UniquetteStatus.Approved;
        _uniquettes[hash].salePrice = _initialUniquettePrice;
        _uniquettes[hash].initialSale = true;

        emit UniquetteApproved(
            _msgSender(),
            _uniquettes[hash].author,
            hash,
            newTokenId
        );
    }

    function uniquetteReject(string calldata hash) public nonReentrant {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(_uniquettes[hash].author != address(0), "submission not found");
        require(_uniquettes[hash].status == UniquetteStatus.PendingApproval, "submission not pending approval");

        address originalSubmitter = _uniquettes[hash].author;
        delete _uniquettes[hash];

        emit UniquetteRejected(_msgSender(), originalSubmitter, hash);
    }

    function uniquetteForSale(uint256 tokenId, uint256 price) public virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        string memory hash = _idToHashMapping[tokenId];
        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette is not approved");

        address operator = _msgSender();
        address owner = _uniquettes[hash].owner;

        require(
            owner == _msgSender() || isApprovedForAll(owner, _msgSender()),
            'Directory: caller is not owner nor approved'
        );

        // Check if price is reasonable
        uint256 minSensiblePrice = _uniquettes[hash].collateralValue;
        uint256 maxAllowedPriceByCollateral = _uniquettes[hash].collateralValue + ((_maxPriceIncrease * _uniquettes[hash].collateralValue) / 10000);
        uint256 maxAllowedPriceByLastPurchase = _uniquettes[hash].lastPurchaseAmount + ((_maxPriceIncrease * _uniquettes[hash].lastPurchaseAmount) / 10000);

        require(price > minSensiblePrice, "Directory: sale price must be more than collateral");
        require(price <= maxAllowedPriceByCollateral || price <= maxAllowedPriceByLastPurchase, "Directory: sale price exceeds max allowed");

        _uniquettes[hash].salePrice = price;

        emit PutForSale(operator, owner, tokenId, hash, price);
    }

    function uniquetteNotForSale(uint256 tokenId) public virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        string memory hash = _idToHashMapping[tokenId];
        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette is not approved");

        address operator = _msgSender();
        address owner = _uniquettes[hash].owner;

        require(
            owner == _msgSender() || isApprovedForAll(owner, _msgSender()),
            'Directory: caller is not owner nor approved'
        );

        _uniquettes[hash].salePrice = 0;

        emit TakeOffFromSale(operator, owner, tokenId, hash);
    }

    function uniquetteBuy(address to, uint256 tokenId) payable public virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        // Check if uniquette is sellable
        string memory hash = _idToHashMapping[tokenId];

        require(to != address(0), "Directory: buy to the zero address");
        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette not approved");
        require(_uniquettes[hash].salePrice > 0 , "Directory: uniquette not for sale");

        address operator = _msgSender();

        // Check if ETH payment is enough
        uint256 protocolFeeAmount = _uniquettes[hash].salePrice * _protocolFee / 10000;
        require(
            msg.value >= _uniquettes[hash].salePrice + protocolFeeAmount,
            "Directory: insufficient payment for sale price plus protocol fee"
        );

        // Find out who should be paid for the sale and how much
        uint256 saleReceivableAmount;
        address saleAmountReceiver;
        if (_uniquettes[hash].initialSale) {
            _uniquettes[hash].initialSale = false;
            saleReceivableAmount = _uniquettes[hash].salePrice * _originalAuthorShare / 10000;
            saleAmountReceiver = _uniquettes[hash].author;
        } else {
            saleReceivableAmount = _uniquettes[hash].salePrice;
            saleAmountReceiver = _uniquettes[hash].owner;
        }

        // Calculate extra ETH sent to be kept as collateral
        uint256 additionalCollateral = msg.value - saleReceivableAmount - protocolFeeAmount;
        _uniquettes[hash].collateralValue += additionalCollateral;

        // Remember last amount this uniquette was sold for
        _uniquettes[hash].lastPurchaseAmount = msg.value;

        // Remove from being on sale
        _uniquettes[hash].salePrice = 0;

        // Transfer ownership of uniquette in ERC-721 fashion
        _approve(operator, tokenId);
        _transfer(_uniquettes[hash].owner, to, tokenId);
        emit UniquetteBought(operator, _uniquettes[hash].owner, to, tokenId);

        // Pay the seller, pay the protocol, move the collateral to Vault
        payable(address(_treasury)).transfer(protocolFeeAmount);
        emit ProtocolFeePaid(operator, _uniquettes[hash].owner, to, tokenId, protocolFeeAmount);

        payable(address(_vault)).transfer(additionalCollateral);
        emit CollateralIncreased(operator, _uniquettes[hash].owner, to, tokenId, additionalCollateral);

        payable(address(saleAmountReceiver)).transfer(saleReceivableAmount);
    }
}
