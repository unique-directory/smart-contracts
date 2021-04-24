//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "./Common.sol";
import "./PaymentRecipient.sol";
import "./Directory.sol";

contract Marketer is Common, ReentrancyGuard, AccessControl, IERC721Receiver, PaymentRecipient {
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");

    Directory private _directory;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNOR_ROLE, _msgSender());
    }

    //
    // Modifiers
    //
    modifier isGovernor() {
        require(hasRole(GOVERNOR_ROLE, _msgSender()), "Marketer: caller is not governor");
        _;
    }

    //
    // Generic and standard functions
    //
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    //
    // Admin functions
    //
    function setDirectoryAddress(address newAddress) isGovernor() public virtual {
        _directory = Directory(newAddress);
    }

    // TODO Implement exchange integrations (Wyvern Protocol, Rarible, etc.)
}
