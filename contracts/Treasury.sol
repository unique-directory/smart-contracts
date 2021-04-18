//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import "./Common.sol";
import "./Token.sol";
import "./PaymentRecipient.sol";

contract Treasury is Common, AccessControl, PaymentRecipient {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    event BoughtBack(address initiator, uint256 ethAmount, uint256 tokensBought);
    event Burnt(address initiator, uint256 ethAmount);

    Token private _tokenAddress;
    IUniswapV2Router02 private _uniswapRouter;

    constructor(
        address governance,
        address payable uniswapRouter
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNANCE_ROLE, governance);

        _uniswapRouter = IUniswapV2Router02(uniswapRouter);
    }

    function setTokenAddress(address tokenAddress) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Treasury: caller is not an admin");
        _tokenAddress = Token(tokenAddress);
    }

    function buybackAndBurn(uint256 ethAmount, uint256 amountOutMin) public {
        require(hasRole(GOVERNANCE_ROLE, _msgSender()), "Treasury: caller is not allowed to initiate");
        require(ethAmount >= address(this).balance, "Treasury: amount is more than balance");
        require(address(_tokenAddress) != address(0), "Treasury: token address not set yet");

        // Build arguments for uniswap router call
        address[] memory path = new address[](2);
        path[0] = _uniswapRouter.WETH();
        path[1] = address(_tokenAddress);

        // Make the call and give it 30 seconds
        uint[] memory amounts = _uniswapRouter.swapExactETHForTokens{value: ethAmount}(
            amountOutMin,
            path,
            address(this),
            block.timestamp + 30
        );
        emit BoughtBack(_msgSender(), ethAmount, amounts[0]);

        _tokenAddress.burn(amounts[0]);
        emit Burnt(_msgSender(), amounts[0]);
    }
}
