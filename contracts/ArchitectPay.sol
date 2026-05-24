// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArchitectPay {
    address public owner;

    event PaymentSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string  label
    );

    event PayrollRun(
        address indexed sender,
        uint256 totalAmount,
        uint256 employeeCount,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    function recordPayment(
        address recipient,
        uint256 amount,
        string calldata label
    ) external {
        emit PaymentSent(msg.sender, recipient, amount, label);
    }

    function recordPayrollRun(
        uint256 totalAmount,
        uint256 employeeCount
    ) external {
        emit PayrollRun(msg.sender, totalAmount, employeeCount, block.timestamp);
    }
}
