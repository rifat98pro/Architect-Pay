import { encodeFunctionData } from 'viem'
import { executeContractCall } from '@/lib/circle'

const CONTRACT_ADDRESS = '0x052515b1c660c65434c5681e1ca452eded3ac00f'

const RECORD_PAYMENT_ABI = {
  type:            'function' as const,
  name:            'recordPayment',
  stateMutability: 'nonpayable' as const,
  inputs:  [
    { name: 'recipient', type: 'address' },
    { name: 'amount',    type: 'uint256' },
    { name: 'label',     type: 'string'  },
  ],
  outputs: [],
}

const RECORD_PAYROLL_RUN_ABI = {
  type:            'function' as const,
  name:            'recordPayrollRun',
  stateMutability: 'nonpayable' as const,
  inputs:  [
    { name: 'totalAmount',    type: 'uint256' },
    { name: 'employeeCount',  type: 'uint256' },
  ],
  outputs: [],
}

// Fire-and-forget — logs payment on-chain without blocking the response
export function logPaymentOnChain(
  walletId:         string,
  recipientAddress: string,
  amount:           string,
  label:            string,
): void {
  const amountMicro = BigInt(Math.round(parseFloat(amount) * 1_000_000))
  const callData = encodeFunctionData({
    abi:          [RECORD_PAYMENT_ABI],
    functionName: 'recordPayment',
    args:         [recipientAddress as `0x${string}`, amountMicro, label],
  })
  executeContractCall({ walletId, contractAddress: CONTRACT_ADDRESS, callData })
    .catch((err) => console.error('[ArchitectPay] recordPayment failed:', err))
}

// Fire-and-forget — logs payroll run on-chain without blocking the response
export function logPayrollRunOnChain(
  walletId:      string,
  totalAmount:   string,
  employeeCount: number,
): void {
  const amountMicro = BigInt(Math.round(parseFloat(totalAmount) * 1_000_000))
  const callData = encodeFunctionData({
    abi:          [RECORD_PAYROLL_RUN_ABI],
    functionName: 'recordPayrollRun',
    args:         [amountMicro, BigInt(employeeCount)],
  })
  executeContractCall({ walletId, contractAddress: CONTRACT_ADDRESS, callData })
    .catch((err) => console.error('[ArchitectPay] recordPayrollRun failed:', err))
}
