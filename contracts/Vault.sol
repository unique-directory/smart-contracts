//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./Common.sol";

contract Vault is Common, AccessControl, IERC1155Receiver {
    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    )
    override
    pure
    external
    returns(bytes4) {
        return ERC1155_ACCEPTED;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    )
    override
    pure
    external
    returns(bytes4) {
        return ERC1155_BATCH_ACCEPTED;
    }
}
