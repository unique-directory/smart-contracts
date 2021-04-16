//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "hardhat/console.sol";

contract Core is ERC1155, AccessControl, ERC1155Pausable, ERC1155Burnable, ReentrancyGuard {
    using Address for address;
    using Counters for Counters.Counter;

    uint256 constant FUNGIBLE_TOKEN_ID = 1;
    uint256 constant UNIQUETTE_TOKENS_BASE = 999;

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
        UniquetteStatus status;
    }

    mapping(uint => string) internal _idToHashMapping;
    mapping(string => Uniquette) internal _uniquettes;
    mapping(address => mapping(address => bool)) internal _temporaryExchangeApproval; // account => (operator => bool)

    event UniquetteSubmitted(address indexed submitter, string indexed hash);
    event UniquetteApproved(address approver, address indexed submitter, string indexed hash, uint256 indexed tokenId);
    event UniquetteRejected(address approver, address indexed submitter, string indexed hash);
    event UniquetteBought(address operator, address indexed seller, address indexed buyer, uint256 indexed tokenId);
    event ProtocolFeePaid(address indexed operator, address seller, address indexed buyer, uint256 indexed tokenId, uint256 feePaid);
    event CollateralIncreased(address indexed operator, address seller, address indexed buyer, uint256 indexed tokenId, uint256 additionalCollateral);
    event PutForSale(address indexed operator, address indexed seller, uint256 indexed tokenId, uint256 price);

    string private _baseURI;
    address payable private _vault;
    address payable private _treasury;
    address payable private _approver;
    address payable private _marketer;

    uint256 private _initialUniquettePrice;
    uint256 private _originalAuthorShare;
    uint256 private _protocolFee;
    uint256 private _submissionPrize;
    uint256 private _currentMetadataVersion;
    uint256 private _minMetadataVersion;
    uint256 private _maxPriceIncrease;

    uint256 private _totalFungibleSupply;

    Counters.Counter private _uniquetteNonce;

    constructor(
        string memory baseURI,
        string memory fungibleTokenHash,
        address payable vault,
        address payable treasury,
        address payable approver,
        address payable marketer,
        uint256[7] memory uints
    ) ERC1155(baseURI) {
        _baseURI = baseURI;
        _vault = vault;
        _treasury = treasury;
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

        _idToHashMapping[FUNGIBLE_TOKEN_ID] = fungibleTokenHash;
    }

    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        return string(abi.encodePacked(_baseURI, _idToHashMapping[tokenId]));
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

    function totalSupply(uint256 _id) public view returns (uint256) {
        return _id == FUNGIBLE_TOKEN_ID ? _totalFungibleSupply : 1;
    }

    function burn(address account, uint256 id, uint256 value) public override virtual {
        require(
            id == FUNGIBLE_TOKEN_ID,
            "Core: only fungible tokens are burnable"
        );
        require(
            account == _msgSender() || isApprovedForAll(account, _msgSender()),
            "ERC1155: caller is not owner nor approved"
        );

        _burn(account, id, value);
    }

    function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
        return
            // Marketer contract should be able to transfer uniquettes if they are sold in a DEX
            operator == _marketer ||
            // When users buy directly from this contract we should allow the to take over the NFT token in the same tx
            _temporaryExchangeApproval[account][operator] == true ||
            // For normal fungible token case we need to respect the standard
            super.isApprovedForAll(account, operator);
    }

    function submitUniquette(string calldata hash) public nonReentrant {
        require(_uniquettes[hash].author == address(0), "already submitted");

        _uniquettes[hash].author = _msgSender();
        _uniquettes[hash].status = UniquetteStatus.PendingApproval;

        emit UniquetteSubmitted(_msgSender(), hash);
    }

    function approveSubmission(string calldata hash) public nonReentrant {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(_uniquettes[hash].author != address(0), "submission not found");
        require(_uniquettes[hash].status == UniquetteStatus.PendingApproval, "submission not pending approval");

        _uniquetteNonce.increment();
        uint256 newTokenId = UNIQUETTE_TOKENS_BASE + _uniquetteNonce.current();

        _mint(
            _vault,
            newTokenId,
            1,
            bytes(hash)
        );
        _mintFungibleToken(
            _uniquettes[hash].author,
            _submissionPrize,
            bytes(Strings.toString(newTokenId))
        );

        _idToHashMapping[newTokenId] = hash;
        _uniquettes[hash].owner = _vault;
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

    function rejectSubmission(string calldata hash) public nonReentrant {
        require(hasRole(APPROVER_ROLE, _msgSender()), "caller is not an approver");
        require(_uniquettes[hash].author != address(0), "submission not found");
        require(_uniquettes[hash].status == UniquetteStatus.PendingApproval, "submission not pending approval");

        address originalSubmitter = _uniquettes[hash].author;
        delete _uniquettes[hash];

        emit UniquetteRejected(_msgSender(), originalSubmitter, hash);
    }

    function putForSale(uint256 id, uint256 price) payable public virtual nonReentrant {
        // Check if uniquette is sellable
        require(id >= UNIQUETTE_TOKENS_BASE, "Core: only non-fungible uniquettes can be put on sale");

        string memory hash = _idToHashMapping[id];
        require(_uniquettes[hash].author != address(0), "Core: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Core: uniquette not approved");

        // The account putting uniquette on sale, it can be different than seller.
        address operator = _msgSender();
        address owner = _uniquettes[hash].owner;

        require(
            _uniquettes[hash].owner == _msgSender() || isApprovedForAll(_uniquettes[hash].owner, _msgSender()),
            'Core: caller is not owner nor approved'
        );

        // Check if price is reasonable
        uint256 minSensiblePrice = _uniquettes[hash].collateralValue;
        uint256 maxAllowedPriceByCollateral = _uniquettes[hash].collateralValue + ((_maxPriceIncrease * _uniquettes[hash].collateralValue) / 10000);
        uint256 maxAllowedPriceByLastPurchase = _uniquettes[hash].lastPurchaseAmount + ((_maxPriceIncrease * _uniquettes[hash].lastPurchaseAmount) / 10000);

        require(price > minSensiblePrice, "Core: sale price must be more than collateral");
        require(price <= maxAllowedPriceByCollateral || price <= maxAllowedPriceByLastPurchase, "Core: sale price exceeds max allowed");

        _uniquettes[hash].salePrice = price;

        emit PutForSale(operator, _uniquettes[hash].owner, id, price);
    }

    function safeBuy(address to, uint256 id, bytes memory data) payable public virtual nonReentrant {
        // Check if uniquette is sellable
        string memory hash = _idToHashMapping[id];

        require(to != address(0), "Core: buy to the zero address");
        require(_uniquettes[hash].author != address(0), "Core: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Core: uniquette not approved");
        require(_uniquettes[hash].salePrice > 0 , "Core: uniquette not for sale");
        require(id >= UNIQUETTE_TOKENS_BASE, "Core: only non-fungible uniquettes can be bought");

        // The account buying the uniquette, it can be different than buyer and seller.
        address operator = _msgSender();

        // Check if ETH payment is enough
        uint256 protocolFeeAmount = _uniquettes[hash].salePrice * _protocolFee / 10000;

        require(
            msg.value >= _uniquettes[hash].salePrice + protocolFeeAmount,
            "Core: insufficient payment for sale price plus protocol fee"
        );

        uint256 saleReceivableAmount;
        address saleAmountReceiver;

        // Find out who should be paid for the sale and how much
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

        // Transfer ownership of uniquette in ERC-1155 fashion
        _temporaryExchangeApproval[_uniquettes[hash].owner][operator] = true; // TODO: is there a safer way to allow internal calls
        safeTransferFrom(_uniquettes[hash].owner, to, id, 1, data);
        delete _temporaryExchangeApproval[_uniquettes[hash].owner][operator];
        emit UniquetteBought(operator, _uniquettes[hash].owner, to, id);

        // Make sure receiver is aware of this ERC-1155 transfer
        _doSafeBatchTransferAcceptanceCheckInternal(operator, _uniquettes[hash].owner, to, _asSingletonArrayPrivate(id), _asSingletonArrayPrivate(1), data);

        // Pay the seller, pay the protocol, move the collateral to Vault
        payable(_treasury).transfer(protocolFeeAmount);
        emit ProtocolFeePaid(operator, _uniquettes[hash].owner, to, id, protocolFeeAmount);

        payable(_vault).transfer(additionalCollateral);
        emit CollateralIncreased(operator, _uniquettes[hash].owner, to, id, additionalCollateral);

        payable(address(saleAmountReceiver)).transfer(saleReceivableAmount);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal virtual override(ERC1155, ERC1155Pausable) {
        for (uint256 i = 0; i < ids.length; ++i) {
            require(
            // Transfers must be either on fungible tokens (UNQ)
                ids[i] == FUNGIBLE_TOKEN_ID ||
                // or, operated by marketer contract on non-fungible tokens (when selling on a DEX)
                operator == _marketer ||
                // or, operated by approver contract on non-fungible tokens (when approving a submission)
                operator == _approver ||
                // or, during safeBuy where we temporarily allow buyer to take over the uniquette
                _temporaryExchangeApproval[from][operator] == true,
                "Core: only marketer, approver or buyer can operate non-fungible token transfers"
            );

            if (ids[i] >= UNIQUETTE_TOKENS_BASE) {
                _uniquettes[_idToHashMapping[ids[i]]].owner = to;
            }
        }

        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function _mintFungibleToken(address account, uint256 amount, bytes memory data) internal virtual {
        _mint(
            account,
            FUNGIBLE_TOKEN_ID,
            amount,
            data
        );
        _totalFungibleSupply += amount;
    }

    function _doSafeBatchTransferAcceptanceCheckInternal(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) internal {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
                if (response != IERC1155Receiver(to).onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function _asSingletonArrayPrivate(uint256 element) private pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = element;

        return array;
    }
}
