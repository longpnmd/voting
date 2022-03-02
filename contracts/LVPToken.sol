// contracts/PNLToken.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LVPToken is ERC20 {
    constructor(uint256 _total_supply) ERC20("LONGPN", "LVP") {
        _mint(msg.sender, _total_supply * (10**18));
    }
}