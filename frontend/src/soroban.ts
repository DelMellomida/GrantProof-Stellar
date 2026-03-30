import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api'
import {
  Client as GrantProofClient,
  ContractError,
  networks,
  type GrantRecord,
} from './bindings/src/index'
import type { SignTransaction } from '@stellar/stellar-sdk/contract'

export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID ?? networks.testnet.contractId
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? networks.testnet.networkPassphrase
export const SOROBAN_RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'

export type WalletConnection = {
  address: string
  walletNetworkPassphrase?: string
  networkMatchesApp: boolean
}

const createClient = (publicKey?: string) =>
  new GrantProofClient({
    contractId: CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
  })

const createFreighterSigner = (address: string): SignTransaction => {
  return async (xdr, options) => {
    const response = await signTransaction(xdr, {
      address,
      networkPassphrase: options?.networkPassphrase ?? NETWORK_PASSPHRASE,
    })

    if (response.error) {
      throw new Error(response.error.message)
    }

    return response
  }
}

const toI128 = (value: string): bigint => {
  if (!value.trim()) {
    throw new Error('Amount is required')
  }

  return BigInt(value.trim())
}

const assertContractAddress = (address: string, label: string) => {
  const normalized = address.trim()

  if (!/^C[A-Z0-9]{55}$/.test(normalized)) {
    throw new Error(`${label} must be a Soroban contract address (starts with C...)`)
  }

  if (normalized === CONTRACT_ID) {
    throw new Error(`${label} cannot be this GrantProof contract address. Use a token contract address.`)
  }
}

export const connectWallet = async (): Promise<WalletConnection> => {
  const connected = await isConnected()
  if (connected.error) {
    throw new Error(connected.error.message)
  }
  if (!connected.isConnected) {
    throw new Error('Freighter extension is not detected in this browser')
  }

  const access = await requestAccess()
  if (access.error || !access.address) {
    throw new Error(access.error?.message ?? 'Wallet access was not granted')
  }

  const network = await getNetworkDetails()
  if (network.error) {
    throw new Error(network.error.message)
  }

  return {
    address: access.address,
    walletNetworkPassphrase: network.networkPassphrase,
    networkMatchesApp: network.networkPassphrase === NETWORK_PASSPHRASE,
  }
}

export const submitProof = async (params: {
  walletAddress: string
  proofHash: string
  amountSpent: string
}) => {
  const client = createClient(params.walletAddress)
  const tx = await client.submit_proof({
    proof_hash: params.proofHash.trim(),
    ngo_wallet: params.walletAddress,
    amount_spent: toI128(params.amountSpent),
  })

  const sent = await tx.signAndSend({
    signTransaction: createFreighterSigner(params.walletAddress),
  })

  return sent.result
}

export const initializeContract = async (params: {
  walletAddress: string
  fundToken: string
  trancheAmount: string
}) => {
  assertContractAddress(params.fundToken, 'Fund token')

  const client = createClient(params.walletAddress)
  const tx = await client.initialize({
    admin: params.walletAddress,
    fund_token: params.fundToken.trim(),
    tranche_amount: toI128(params.trancheAmount),
  })

  const sent = await tx.signAndSend({
    signTransaction: createFreighterSigner(params.walletAddress),
  })

  return sent.result
}

export const auditProof = async (params: {
  walletAddress: string
  proofHash: string
}) => {
  const client = createClient(params.walletAddress)
  const tx = await client.audit_proof({
    proof_hash: params.proofHash.trim(),
  })

  const sent = await tx.signAndSend({
    signTransaction: createFreighterSigner(params.walletAddress),
  })

  return sent.result
}

export const releaseTranche = async (params: {
  walletAddress: string
  proofHash: string
}) => {
  const client = createClient(params.walletAddress)
  const tx = await client.release_tranche({
    proof_hash: params.proofHash.trim(),
  })

  const sent = await tx.signAndSend({
    signTransaction: createFreighterSigner(params.walletAddress),
  })

  return sent.result
}

export const getGrant = async (proofHash: string): Promise<GrantRecord | null> => {
  const client = createClient()
  const tx = await client.get_grant({ proof_hash: proofHash.trim() })
  return tx.result ?? null
}

const errorEntries = Object.entries(ContractError)

export const humanizeContractError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)

  if (
    /zero balance is not sufficient to spend|Error\(Contract,\s*#10\)/i.test(
      message,
    )
  ) {
    return 'Insufficient fund token balance on the GrantProof contract. Transfer token funds to the contract address first, then retry release_tranche.'
  }

  if (/not a contract address|Error\(Object,\s*InvalidInput\)/i.test(message)) {
    return 'Invalid fund token address for release. Re-run initialize() with a valid Soroban token contract address (C...), then retry release_tranche.'
  }

  if (
    /WasmVm,\s*InvalidAction|UnreachableCodeReached/i.test(message) &&
    /audit_proof|release_tranche/i.test(message)
  ) {
    return 'Contract panic during admin action. Most likely the contract was not initialized (missing Admin/FundToken/TrancheAmount). Run initialize() once on this contract ID using the intended admin wallet, then retry audit/release.'
  }

  if (
    /require_auth|not authorized|unauthorized|signature|auth/i.test(message)
  ) {
    return 'Authorization failed: connect the admin wallet used in initialize() to approve/release.'
  }

  const contractCodeMatch = message.match(/Error\(Contract,\s*#(\d+)\)/i)
  if (contractCodeMatch) {
    const matched = ContractError[Number(contractCodeMatch[1]) as keyof typeof ContractError]
    if (matched) {
      return `Contract error: ${matched.message}`
    }
  }

  for (const [, detail] of errorEntries) {
    if (message.includes(detail.message)) {
      return `Contract error: ${detail.message}`
    }
  }

  return message
}
