// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract WSIZE {
    string public name = "Wrapped SIZE";
    string public symbol = "WSIZE";
    uint8 public decimals = 18;

    uint256 public totalSupply;

    mapping(address => suint256) private _balances;
    mapping(address => mapping(address => suint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Deposit(address indexed dst, uint256 wad);
    event Withdraw(address indexed src, uint256 wad);

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _balances[msg.sender] += suint256(msg.value);
        totalSupply += msg.value;

        emit Deposit(msg.sender, msg.value);
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(suint256 amount) public {
        require(_balances[msg.sender] >= amount, "Insufficient WSIZE balance");

        _balances[msg.sender] -= amount;
        uint256 amountUint = uint256(amount);
        totalSupply -= amountUint;

        (bool success, ) = msg.sender.call{value: amountUint}("");
        require(success, "ETH transfer failed");

        emit Withdraw(msg.sender, amountUint);
        emit Transfer(msg.sender, address(0), amountUint);
    }

    function transfer(address to, suint256 amount) public returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;

        emit Transfer(msg.sender, to, uint256(amount));
        return true;
    }

    function approve(address spender, suint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, uint256(amount));
        return true;
    }

    function transferFrom(
        address from,
        address to,
        suint256 amount
    ) public returns (bool) {
        suint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        require(_balances[from] >= amount, "Insufficient balance");

        if (currentAllowance != suint256(type(uint256).max)) {
            _allowances[from][msg.sender] = currentAllowance - amount;
        }
        
        _balances[from] -= amount;
        _balances[to] += amount;

        emit Transfer(from, to, uint256(amount));
        return true;
    }

    function balanceOf(address account) public view returns (uint256) {
        require(
            msg.sender == account,
            "Unauthorized: Only owner can view balance"
        );
        return uint256(_balances[account]);
    }

    function allowance(
        address owner,
        address spender
    ) public view returns (uint256) {
        require(
            msg.sender == owner || msg.sender == spender,
            "Unauthorized: Not owner or spender"
        );
        return uint256(_allowances[owner][spender]);
    }
}