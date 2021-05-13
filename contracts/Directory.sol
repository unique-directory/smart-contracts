//SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "./Common.sol";
import "./Token.sol";
import "./Vault.sol";
import "./Treasury.sol";
import "./Marketer.sol";

contract Directory is
    ContextUpgradeable,
    AccessControlUpgradeable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    enum UniquetteStatus {PendingApproval, PendingUpgrade, Approved}

    struct Uniquette {
        address author;
        address owner;
        uint256 collateralValue;
        uint256 lastPurchaseAmount;
        uint256 salePrice;
        bool firstSale;
        uint256 submissionReward;
        uint256 metadataVersion;
        uint256 tokenId;
        uint256 submissionDeposit;
        uint256 submitTime;
        uint256 firstSaleDeadline;
        UniquetteStatus status;
    }

    event UniquetteSubmitted(address indexed submitter, string hash, uint256 collateral);
    event UniquetteApproved(address approver, address indexed submitter, string hash, uint256 indexed tokenId);
    event UniquetteRejected(address approver, address indexed submitter, string hash);
    event UniquetteBought(address operator, address indexed seller, address indexed buyer, uint256 indexed tokenId);
    event UniquetteCollateralIncreased(
        address indexed operator,
        address indexed owner,
        uint256 indexed tokenId,
        uint256 additionalCollateral
    );
    event UniquettePutForSale(
        address indexed operator,
        address indexed seller,
        uint256 indexed tokenId,
        string hash,
        uint256 price
    );
    event UniquetteTakeOffFromSale(
        address indexed operator,
        address indexed seller,
        uint256 indexed tokenId,
        string hash
    );
    event ProtocolFeePaid(
        address indexed operator,
        address seller,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 feePaid
    );

    string private _tokensBaseURI;
    Token private _token;
    Vault private _vault;
    Treasury private _treasury;
    Marketer private _marketer;

    uint256 private _initialUniquettePrice;
    uint256 private _originalAuthorShare;
    uint256 private _protocolFee;
    uint256 private _submissionDeposit;
    uint256 private _firstSaleDeadline;
    uint256 private _currentMetadataVersion;
    uint256 private _minMetadataVersion;
    uint256 private _maxPriceIncrease;

    mapping(uint256 => string) internal _idToHashMapping;
    mapping(string => Uniquette) internal _uniquettes;

    CountersUpgradeable.Counter private _tokenIdTracker;

    function initialize(
        string memory name,
        string memory symbol,
        string memory tokensBaseURI,
        address token,
        address payable vault,
        address payable treasury,
        address payable marketer,
        uint256[8] memory uints
    ) public initializer {
        //        __Context_init();
        //        __AccessControlEnumerable_init();
        //        __ERC721Enumerable_init();
        //        __ERC721Pausable_init();
        __ERC721_init(name, symbol);
        //        __ReentrancyGuard_init();

        _tokensBaseURI = tokensBaseURI;
        _token = Token(token);
        _vault = Vault(vault);
        _treasury = Treasury(treasury);
        _marketer = Marketer(marketer);

        _initialUniquettePrice = uints[0];
        _originalAuthorShare = uints[1];
        _protocolFee = uints[2];
        _submissionDeposit = uints[3];
        _firstSaleDeadline = uints[4];
        _currentMetadataVersion = uints[5];
        _minMetadataVersion = uints[6];
        _maxPriceIncrease = uints[7];

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNOR_ROLE, _msgSender());
    }

    //
    // Modifiers
    //
    modifier isGovernor() {
        require(hasRole(GOVERNOR_ROLE, _msgSender()), "Directory: caller is not governor");
        _;
    }

    //
    // Generic and standard functions
    //
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, ERC721Upgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function getParameters()
        public
        view
        virtual
        returns (
            uint256 initialUniquettePrice,
            uint256 originalAuthorShare,
            uint256 protocolFee,
            uint256 submissionDeposit,
            uint256 firstSaleDeadline,
            uint256 currentMetadataVersion,
            uint256 minMetadataVersion,
            uint256 maxPriceIncrease
        )
    {
        return (
            _initialUniquettePrice,
            _originalAuthorShare,
            _protocolFee,
            _submissionDeposit,
            _firstSaleDeadline,
            _currentMetadataVersion,
            _minMetadataVersion,
            _maxPriceIncrease
        );
    }

    //
    // Admin functions
    //
    function pause() public virtual isGovernor() {
        _pause();
    }

    function unpause() public virtual isGovernor() {
        _unpause();
    }

    function setTokenAddress(address newAddress) public isGovernor() {
        _token = Token(newAddress);
    }

    function setVaultAddress(address payable newAddress) public isGovernor() {
        _vault = Vault(newAddress);
    }

    function setTreasuryAddress(address payable newAddress) public isGovernor() {
        _treasury = Treasury(newAddress);
    }

    function setMarketerAddress(address payable newAddress) public isGovernor() {
        _marketer = Marketer(newAddress);
    }

    function setInitialUniquettePrice(uint256 newValue) public isGovernor() {
        _initialUniquettePrice = newValue;
    }

    function setOriginalAuthorShare(uint256 newValue) public isGovernor() {
        _originalAuthorShare = newValue;
    }

    function setProtocolFee(uint256 newValue) public isGovernor() {
        _protocolFee = newValue;
    }

    function setSubmissionCollateral(uint256 newValue) public isGovernor() {
        _submissionDeposit = newValue;
    }

    function setFirstSaleDeadline(uint256 newValue) public isGovernor() {
        _firstSaleDeadline = newValue;
    }

    function setCurrentMetadataVersion(uint256 newValue) public isGovernor() {
        _currentMetadataVersion = newValue;
    }

    function setMinMetadataVersion(uint256 newValue) public isGovernor() {
        _minMetadataVersion = newValue;
    }

    function setMaxPriceIncrease(uint256 newValue) public isGovernor() {
        _maxPriceIncrease = newValue;
    }

    //
    // Customized ERC-721 functions
    //
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "Directory: URI query for nonexistent token");

        return string(abi.encodePacked(_tokensBaseURI, _idToHashMapping[tokenId]));
    }

    function burn(uint256 tokenId) public virtual isGovernor() {
        Uniquette memory uniquette = _uniquettes[_idToHashMapping[tokenId]];
        require(
            // Either it must be owned by Vault which means it's liquidated and currently locked in Vault
            (uniquette.owner == address(_vault)) ||
                // Or deadline for first sale is passed and no one was interested in buying the uniquette
                (uniquette.firstSaleDeadline > block.timestamp),
            "Directory: only uniquettes locked in vault or passed first sale deadline can be burnt"
        );

        _burn(tokenId);
    }

    function batchBurn(uint256[] calldata tokenIds) public virtual isGovernor() {
        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            this.burn(id);
        }
    }

    function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
        return (// Transfers must be either operated by governor (when approving a submission)
        hasRole(GOVERNOR_ROLE, operator) ||
            // or, operated by marketer contract (when selling on an exchange)
            operator == address(_marketer) ||
            // or, operated by vault contract (when liquidating a uniquette)
            operator == address(_vault) ||
            // or, operator is approved during buy operation
            super.isApprovedForAll(account, operator));
    }

    // We need to override to remove "orOwner" since we should not allow transfers initiated directly by owners
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual override returns (bool) {
        require(_exists(tokenId), "Directory: operator query for nonexistent token");
        address owner = ERC721Upgradeable.ownerOf(tokenId);
        return (getApproved(tokenId) == spender || this.isApprovedForAll(owner, spender));
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721Upgradeable, ERC721PausableUpgradeable, ERC721EnumerableUpgradeable) {
        _uniquettes[_idToHashMapping[tokenId]].owner = to;
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) public virtual override {
        revert("Directory: approve not supported on uniquette transfers");
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        revert("Directory: setApprovalForAll not supported on uniquette transfers");
    }

    //
    // Unique functions
    //
    function uniquetteHashById(uint256 tokenId) public view virtual returns (string memory) {
        require(_exists(tokenId), "Directory: query for nonexistent token");
        require(_uniquettes[_idToHashMapping[tokenId]].author != address(0), "Directory: uniquette not found");

        return _idToHashMapping[tokenId];
    }

    function uniquetteGetByHash(string calldata hash) public view virtual returns (Uniquette memory) {
        Uniquette memory uniquette = _uniquettes[hash];
        require(uniquette.author != address(0), "Directory: uniquette not found");

        return uniquette;
    }

    function uniquetteSubmit(string calldata hash, uint256 metadataVersion) public payable nonReentrant {
        require(_uniquettes[hash].author == address(0), "Directory: already submitted");
        require(msg.value == _submissionDeposit, "Directory: exact collateral value required not less not more");
        require(
            metadataVersion == _currentMetadataVersion,
            "Directory: metadata version is not current, please upgrade"
        );

        _uniquettes[hash].author = _msgSender();
        _uniquettes[hash].metadataVersion = metadataVersion;
        _uniquettes[hash].status = UniquetteStatus.PendingApproval;
        _uniquettes[hash].submissionDeposit = msg.value;
        _uniquettes[hash].submitTime = block.timestamp;
        _uniquettes[hash].firstSaleDeadline = block.timestamp + _firstSaleDeadline;

        emit UniquetteSubmitted(_msgSender(), hash, msg.value);
    }

    function uniquetteApprove(string calldata hash, uint256 submissionReward) public isGovernor() nonReentrant {
        require(_uniquettes[hash].author != address(0), "Directory: submission not found");
        require(
            _uniquettes[hash].status == UniquetteStatus.PendingApproval,
            "Directory: submission not pending approval"
        );
        require(
            _uniquettes[hash].metadataVersion == _currentMetadataVersion,
            "Directory: metadata version is not current, must be upgraded"
        );

        _tokenIdTracker.increment();
        uint256 newTokenId = _tokenIdTracker.current();

        // Send the new uniquette to Vault
        _mint(address(_vault), newTokenId);

        _idToHashMapping[newTokenId] = hash;
        _uniquettes[hash].owner = address(_vault);
        _uniquettes[hash].tokenId = newTokenId;
        _uniquettes[hash].status = UniquetteStatus.Approved;
        _uniquettes[hash].salePrice = _initialUniquettePrice;
        _uniquettes[hash].firstSale = true;
        _uniquettes[hash].submissionReward = submissionReward;

        // Return the submit collateral to author
        payable(address(_uniquettes[hash].author)).sendValue(_uniquettes[hash].submissionDeposit);

        emit UniquetteApproved(_msgSender(), _uniquettes[hash].author, hash, newTokenId);
    }

    function uniquetteReject(string calldata hash) public isGovernor() nonReentrant {
        require(_uniquettes[hash].author != address(0), "Directory: submission not found");
        require(
            _uniquettes[hash].status == UniquetteStatus.PendingApproval,
            "Directory: submission not pending approval"
        );

        address originalSubmitter = _uniquettes[hash].author;
        uint256 submissionDeposit = _uniquettes[hash].submissionDeposit;
        delete _uniquettes[hash];

        // Seize the submit collateral to treasury
        payable(address(_treasury)).sendValue(submissionDeposit);

        emit UniquetteRejected(_msgSender(), originalSubmitter, hash);
    }

    function uniquetteForSale(uint256 tokenId, uint256 price) public virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        string memory hash = _idToHashMapping[tokenId];
        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette is not approved");
        require(
            _uniquettes[hash].metadataVersion >= _minMetadataVersion,
            "Directory: metadata version is too old, please upgrade"
        );

        address operator = _msgSender();
        address owner = _uniquettes[hash].owner;

        require(
            owner == _msgSender() || isApprovedForAll(owner, _msgSender()),
            "Directory: caller is not owner nor approved"
        );

        // Check if price is reasonable
        uint256 minSensiblePrice = _uniquettes[hash].collateralValue;
        uint256 maxAllowedPriceByCollateral =
            _uniquettes[hash].collateralValue + ((_maxPriceIncrease * _uniquettes[hash].collateralValue) / 10000);
        uint256 maxAllowedPriceByLastPurchase =
            _uniquettes[hash].lastPurchaseAmount + ((_maxPriceIncrease * _uniquettes[hash].lastPurchaseAmount) / 10000);

        require(price >= minSensiblePrice, "Directory: sale price must be equal or more than collateral");
        require(
            price <= maxAllowedPriceByCollateral || price <= maxAllowedPriceByLastPurchase,
            "Directory: sale price exceeds max allowed"
        );

        _uniquettes[hash].salePrice = price;

        emit UniquettePutForSale(operator, owner, tokenId, hash, price);
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
            "Directory: caller is not owner nor approved"
        );

        _uniquettes[hash].salePrice = 0;

        emit UniquetteTakeOffFromSale(operator, owner, tokenId, hash);
    }

    function uniquetteBuy(address to, uint256 tokenId) public payable virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        // Check if uniquette is sellable
        string memory hash = _idToHashMapping[tokenId];

        require(to != address(0), "Directory: buy to the zero address");
        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette not approved");
        require(_uniquettes[hash].salePrice > 0, "Directory: uniquette not for sale");
        require(
            _uniquettes[hash].metadataVersion >= _minMetadataVersion,
            "Directory: metadata version is too old, must be upgraded"
        );

        address operator = _msgSender();

        // Check if ETH payment is enough
        uint256 protocolFeeAmount = (_uniquettes[hash].salePrice * _protocolFee) / 10000;
        require(
            msg.value >= _uniquettes[hash].salePrice + protocolFeeAmount,
            "Directory: insufficient payment for sale price plus protocol fee"
        );

        // Find out who should be paid for the sale and how much
        uint256 saleReceivableAmount;
        address saleAmountReceiver;
        uint256 saleRewardAmount;
        address saleRewardReceiver;
        if (_uniquettes[hash].firstSale) {
            _uniquettes[hash].firstSale = false;
            saleReceivableAmount = (_uniquettes[hash].salePrice * _originalAuthorShare) / 10000;
            saleAmountReceiver = _uniquettes[hash].author;
            saleRewardAmount = _uniquettes[hash].submissionReward;
            saleRewardReceiver = _uniquettes[hash].author;
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

        // Pay the protocol fee, move the collateral to Vault, pay the seller
        payable(address(_treasury)).sendValue(protocolFeeAmount);
        emit ProtocolFeePaid(operator, _uniquettes[hash].owner, to, tokenId, protocolFeeAmount);

        payable(address(_vault)).sendValue(additionalCollateral);
        emit UniquetteCollateralIncreased(operator, to, tokenId, additionalCollateral);

        if (saleReceivableAmount > 0) {
            payable(address(saleAmountReceiver)).sendValue(saleReceivableAmount);
        }

        // Compensate original author for their submission with ERC-20 tokens
        if (saleRewardReceiver != address(0) && saleRewardAmount > 0) {
            _token.mint(saleRewardReceiver, saleRewardAmount);
        }
    }

    function uniquetteIncreaseCollateral(uint256 tokenId) public payable virtual nonReentrant {
        require(_exists(tokenId), "Directory: nonexistent token");

        // Check if uniquette is sellable
        string memory hash = _idToHashMapping[tokenId];

        require(_uniquettes[hash].author != address(0), "Directory: uniquette does not exist");
        require(_uniquettes[hash].status == UniquetteStatus.Approved, "Directory: uniquette not approved");

        payable(address(_vault)).sendValue(msg.value);

        _uniquettes[hash].collateralValue += msg.value;

        emit UniquetteCollateralIncreased(_msgSender(), _uniquettes[hash].owner, tokenId, msg.value);
    }
}
