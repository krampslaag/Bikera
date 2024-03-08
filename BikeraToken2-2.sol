// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "Bikera Solidity Contract/openzeppelin-contracts-5.0.1/contracts/token/ERC20/ERC20.sol";
import "Bikera Solidity Contract/openzeppelin-contracts-5.0.1/contracts/access/Ownable.sol";
import "Bikera Solidity Contract/openzeppelin-contracts-5.0.1/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Bikera is ERC20, Ownable, ERC20Burnable {
    // Constructor
    uint256 private immutable _cap;
    error ExceededCap(uint256 cap); // Shortened error message for gas optimization
    error InvalidCap(); // Simplified error
    constructor(address initialOwner, uint256 cap_) 
    ERC20("Bikera", "MERA") 
    
    Ownable(initialOwner) {
        _mint(msg.sender, 2500000000000)
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
