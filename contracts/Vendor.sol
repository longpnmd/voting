// contracts/LVPToken.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "./LVPToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vendor is Ownable {
    // CONTRUCTERS ==============================
    uint256 public buyPricePerBNB;    // contract buys lots of token at this price
    uint256 public sellPricePerBNB;   // contract sells lots at this price
    LVPToken token;
    constructor(
        uint _buy_price,
        uint _sell_price,
        address _token
    ){
        buyPricePerBNB = _buy_price;
        sellPricePerBNB = _sell_price;
        token = LVPToken(_token);
    }
    // CONTRUCTERS ==============================

    // EVENTS ===================================
    event BUY_SUCCESS(address buyer, uint256 amountOfBNB, uint256 amountOfTokens);
    event WITHDRAW_SUCCESS(address seller, uint256 amountOfTokens, uint256 amountOfBNB);
    event SELL_SUCCESS(address seller, uint256 amountOfTokens, uint256 amountOfBNB);
    // EVENTS ===================================

    // ADMIN ====================================
    function setTokenRate(uint _buy_price, uint _sell_price) 
        public 
        onlyOwner 
    {
        if(_buy_price > 0) buyPricePerBNB = _buy_price;
        if(_sell_price > 0) sellPricePerBNB = _sell_price;
    }

    // ADMIN ====================================

    // USER =====================================
    function buyTokens() 
        public 
        payable 
        returns(uint256 tokenAmount)
    {
        // console.log("FUNC_BUY_TOKEN | sender: %s : %s BNB", msg.sender, msg.value);
        require(msg.value > 0, "Send BNB to buy some tokens");
        uint256 amountToBuy = msg.value * buyPricePerBNB;
        // check if the Vendor Contract has enough amount of tokens for the transaction
        uint256 vendorBalance = token.balanceOf(address(this));
        // console.log("FUNC_BUY_TOKEN | amountToBuy: %s | balance %s BNB", amountToBuy, vendorBalance);
        require(vendorBalance >= amountToBuy, "Vendor contract has not enough tokens in its balance");
        // Transfer token to the msg.sender
        (bool sent) = token.transfer(msg.sender, amountToBuy);
        require(sent, "Failed to transfer token to user");
        // Emit Event
        emit BUY_SUCCESS(msg.sender, msg.value ,amountToBuy);
        return amountToBuy;
    }
    /**
    * @notice Allow users to sell tokens for BNB
    */
    function sellTokens(uint256 tokenAmountToSell) public {
        // console.log("FUNC_SELL_TOKEN | sender: %s : %s BNB", msg.sender,tokenAmountToSell);
        // Check that the requested amount of tokens to sell is more than 0
        require(tokenAmountToSell > 0, "Specify an amount of token greater than zero");


        // Check that the user's token balance is enough to do the swap
        uint256 userBalance = token.balanceOf(msg.sender);
        require(userBalance >= tokenAmountToSell, "Your balance is lower than the amount of tokens you want to sell");

        // Check that the Vendor's balance is enough to do the swap
        uint256 amountOfBNBToTransfer = tokenAmountToSell / sellPricePerBNB;
        uint256 ownerBNBBalance = address(this).balance;
        // console.log("FUNC_SELL_TOKEN | ownerBNBBalance: %s | amountOfBNBToTransfer %s", ownerBNBBalance, amountOfBNBToTransfer);
        require(ownerBNBBalance >= amountOfBNBToTransfer, "Vendor has not enough funds to accept the sell request");

        (bool sent) = token.transferFrom(msg.sender, address(this), tokenAmountToSell);
        require(sent, "Failed to transfer tokens from user to vendor");


        (sent,) = msg.sender.call{value: amountOfBNBToTransfer}("");
        require(sent, "Failed to send BNB to the user");

         emit SELL_SUCCESS(msg.sender, tokenAmountToSell, amountOfBNBToTransfer);
    }

    /**
    * @notice Allow the owner of the contract to withdraw BNB
    */
    function withdraw() public onlyOwner {
        uint256 ownerBalance = address(this).balance;
        require(ownerBalance > 0, "Owner has not balance to withdraw");

        (bool sent,) = msg.sender.call{value: address(this).balance}("");
        require(sent, "Failed to send user balance back to the owner");
    }
    // USER =====================================
}