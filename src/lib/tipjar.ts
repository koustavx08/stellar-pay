/**
 * Client for the Tip Jar Soroban contract.
 *
 * Reads go through `simulateTransaction`: the RPC server runs the call in a
 * sandbox and hands back the return value, so view functions cost nothing and
 * need no signature. Writes are built, simulated (which fills in the footprint
 * and auth entries), signed by Freighter, then submitted.
 */
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
  type Transaction,
} from '@stellar/stellar-sdk'

import deployment from '../../deployment.json'
import { fromStroops, toStroops } from './stellar'

export const CONTRACT_ID = deployment.contractId
export const RPC_URL = deployment.rpcUrl
export const NETWORK_PASSPHRASE = deployment.networkPassphrase
export const CONTRACT_OWNER = deployment.owner
export const TOKEN_ID = deployment.tokenId

/** Matches MAX_MESSAGE_LEN in the contract. */
export const MAX_TIP_MESSAGE = 140

export const server = new rpc.Server(RPC_URL)

export function explorerContractUrl(): string {
  return `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`
}

export interface TipJarStats {
  /** Total ever tipped, in XLM. */
  totalTips: string
  /** Number of tips received. */
  tipCount: number
  /** Currently held by the contract, in XLM. */
  balance: string
  /** Note attached to the most recent tip. */
  lastMessage: string
}

export async function readStats(): Promise<TipJarStats> {
  const [totalTips, tipCount, balance, lastMessage] = await Promise.all([
    readContract<bigint>('total_tips'),
    readContract<number>('tip_count'),
    readContract<bigint>('balance'),
    readContract<string>('last_message'),
  ])

  return {
    totalTips: fromStroops(totalTips),
    tipCount: Number(tipCount),
    balance: fromStroops(balance),
    lastMessage,
  }
}

/** How much a single address has tipped, in XLM. */
export async function readTipsBy(address: string): Promise<string> {
  const given = await readContract<bigint>('tips_by', Address.fromString(address).toScVal())
  return fromStroops(given)
}

/**
 * Builds a `tip` invocation ready for Freighter to sign.
 *
 * The contract calls `from.require_auth()`. Because `from` is also the
 * transaction source here, Soroban accepts the transaction's own signature as
 * that authorization — so there is no separate auth entry to sign.
 */
export async function buildTipXdr(
  from: string,
  amountXlm: string,
  message: string,
): Promise<string> {
  const account = await server.getAccount(from)
  const contract = new Contract(CONTRACT_ID)

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'tip',
        Address.fromString(from).toScVal(),
        nativeToScVal(toStroops(amountXlm), { type: 'i128' }),
        nativeToScVal(message, { type: 'string' }),
      ),
    )
    .setTimeout(180)
    .build()

  let prepared: Transaction
  try {
    prepared = await server.prepareTransaction(built)
  } catch (error) {
    throw new Error(describeContractError(error))
  }

  return prepared.toXDR()
}

export interface TipResult {
  hash: string
}

export async function submitTip(signedXdr: string): Promise<TipResult> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as Transaction
  const sent = await server.sendTransaction(transaction)

  if (sent.status === 'ERROR') {
    throw new Error(describeContractError(sent.errorResult))
  }

  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    const result = await server.getTransaction(sent.hash)

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return { hash: sent.hash }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(describeContractError(result))
    }

    await new Promise((done) => setTimeout(done, 1500))
  }

  throw new Error('Timed out waiting for the network to confirm the tip.')
}

async function readContract<T>(method: string, ...args: xdr.ScVal[]): Promise<T> {
  // Reads never leave the simulator, so a placeholder sequence number is fine
  // and we avoid a round trip just to look one up.
  const source = new Account(CONTRACT_OWNER, '0')
  const contract = new Contract(CONTRACT_ID)

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const simulated = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Could not read ${method}: ${simulated.error}`)
  }
  if (!simulated.result?.retval) {
    throw new Error(`Contract returned nothing for ${method}.`)
  }

  return scValToNative(simulated.result.retval) as T
}

/** Maps the contract's own error codes back to the messages in lib.rs. */
const CONTRACT_ERRORS: Record<number, string> = {
  1: 'The tip jar is already initialized.',
  2: 'The tip jar has not been initialized.',
  3: 'Tip amount must be greater than 0.',
  4: `Your message is too long (max ${MAX_TIP_MESSAGE} characters).`,
  5: 'There is nothing in the jar to withdraw.',
}

export function describeContractError(error: unknown): string {
  const text = collectText(error)

  const contractCode = text.match(/Error\(Contract, #(\d+)\)/)
  if (contractCode) {
    const mapped = CONTRACT_ERRORS[Number(contractCode[1])]
    if (mapped) return mapped
  }

  // The token contract rejects a transfer the tipper cannot cover.
  if (/insufficient balance|balance is not sufficient/i.test(text)) {
    return 'Not enough XLM: remember 1 XLM stays locked as the account reserve, plus fees.'
  }
  if (/trustline|not authorized/i.test(text)) {
    return 'Your account cannot send this asset.'
  }

  if (error instanceof Error) return error.message
  return 'The contract call failed.'
}

/**
 * Pulls searchable text out of whatever the SDK threw.
 *
 * `JSON.stringify` on an Error returns "{}" — its message lives on a
 * non-enumerable property — so stringifying first would hide the very contract
 * code we are trying to read.
 */
function collectText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return `${error.message} ${String(error.cause ?? '')}`

  try {
    return JSON.stringify(error ?? '')
  } catch {
    return String(error)
  }
}
