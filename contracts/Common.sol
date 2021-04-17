//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

contract Common {
    uint256 constant internal FUNGIBLE_TOKEN_ID = 1;
    uint256 constant internal UNIQUETTE_TOKENS_BASE = 999;

    bytes4 constant internal ERC1155_ACCEPTED = 0xf23a6e61; // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
    bytes4 constant internal ERC1155_BATCH_ACCEPTED = 0xbc197c81; // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
}
