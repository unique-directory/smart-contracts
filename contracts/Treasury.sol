//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Treasury is AccessControl {
    bytes32 public constant INITIATOR_ROLE = keccak256("INITIATOR_ROLE");

    event BoughtBack(address initiator, uint256 total);
    event Burnt(address initiator, uint256 total);

    constructor(address payable initiator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(INITIATOR_ROLE, initiator);
    }

    function buybackAndBurn() public {
        require(hasRole(INITIATOR_ROLE, _msgSender()), "caller is not an initiator");
        // TODO implement
        emit BoughtBack(_msgSender(), 100);
        emit Burnt(_msgSender(), 100);
    }
}
