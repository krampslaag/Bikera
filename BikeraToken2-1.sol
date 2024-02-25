// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./openzeppelin-contracts-5.0.1/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts-5.0.1/contracts/access/Ownable.sol";
import "./openzeppelin-contracts-5.0.1/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Bikera is ERC20, Ownable, ERC20Burnable {
    // Constructor
    uint256 private immutable _cap;

    constructor(address initialOwner, uint256 cap_) 
    ERC20("Bikera", "MERA") 

    Ownable(initialOwner) {
    _cap = cap_;
    }
    
    function cap() public view virtual returns (uint256) {
        return _cap;
    }


    function mint(address to, uint256 value) public onlyOwner {
        require(totalSupply() + value <= cap(), "MERA cap exceeded, no infinte coins please");
        _mint(to, value);
    }
}
