//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "./Token.sol";

contract PaymentRecipient {
    event ReceivedEther(address indexed sender, uint amount);

    /**
     * @dev Receive Ether and generate a log event
     */
    receive() external payable {
        emit ReceivedEther(msg.sender, msg.value);
    }
}
