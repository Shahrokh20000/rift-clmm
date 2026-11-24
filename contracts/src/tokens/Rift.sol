// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Rift {
    string public constant name = "Rift";
    string public constant symbol = "RFT";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    address public constant OWNER = 0xaBa549De60bc17A6b53A0476E7bAA38b7F55443e;
    mapping(address => uint256) public _balances;
    mapping(address => mapping(address => uint256)) public _allowances;
    mapping(address => uint256) public faucetTimeout;


    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 amount
    );

    constructor() {
        uint256 initialSupply = 10000 * 10 ** 18;
        totalSupply = initialSupply;
        _balances[OWNER] = initialSupply;

        emit Transfer(address(0), OWNER, initialSupply);
    }

    modifier onlyOwner() {
        require(msg.sender == OWNER, "ON");
        _;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(
        address owner,
        address spender
    ) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, uint256(amount));
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, uint256(amount));
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public returns (bool) {
        require(
            _allowances[from][msg.sender] >= amount,
            "Insufficient allowance"
        );
        require(_balances[from] >= amount, "Insufficient balance");

        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;

        emit Transfer(from, to, uint256(amount));
        return true;
    }


    function mint(address to, uint256 amount) public {
        if(msg.sender == OWNER){
        totalSupply += uint256(amount);
        _balances[to] += amount;
        emit Transfer(address(0), to, uint256(amount));
        } else{
            if(block.timestamp - faucetTimeout[msg.sender] > 86000){
                totalSupply += uint256(amount);
                _balances[to] += amount;
                                faucetTimeout[msg.sender] = block.timestamp;

            }
        }
    }

    function burn(address from, uint256 amount) public onlyOwner {
        require(_balances[from] >= amount, "Insufficient balance");
        _balances[from] -= amount;
        totalSupply -= uint256(amount);
        emit Transfer(from, address(0), uint256(amount));
    }
}