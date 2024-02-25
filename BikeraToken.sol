// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./openzeppelin-contracts-5.0.1/contracts/token/ERC20/ERC20.sol";
import "./openzeppelin-contracts-5.0.1/contracts/access/Ownable.sol";
import "./openzeppelin-contracts-5.0.1/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "./openzeppelin-contracts-5.0.1/contracts/token/ERC20/extensions/ERC20Burnable.sol";


contract Bikera is ERC20, ERC20Capped, Ownable , ERC20Burnable{
    constructor(address initialOwner)
        ERC20("Bikera", "MERA")
        ERC20Capped(500000000 * (10**uint256(18)))
        Ownable(initialOwner)
    {
    }
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    function _update(address from, address to, uint256 amount) internal virtual override(ERC20, ERC20Capped) {
    super._update(from, to, amount);
}
}