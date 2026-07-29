import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const FRIENDBOT_URL = 'https://friendbot.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
export const NETWORK = 'TESTNET'

/** Every account must keep 1 XLM (base reserve x 2) locked on-chain. */
export const BASE_RESERVE_XLM = 1
/** Amount sent to a brand new account has to cover its base reserve. */
export const MIN_CREATE_ACCOUNT_XLM = 1

export const server = new Horizon.Server(HORIZON_URL)

export function isValidAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address.trim())
}

/** Decimal amount, up to 7 fractional digits — what Stellar calls a stroop-precision value. */
export const AMOUNT_PATTERN = /^\d*\.?\d*$/

/**
 * The SDK rejects loose decimal strings like "1." or ".5", and floats lose
 * precision at stroop scale, so normalise as text: trim to 7 fractional
 * digits and drop redundant zeros without ever parsing to a number.
 */
export function normalizeAmount(input: string): string {
  const trimmed = input.trim()
  if (!trimmed || trimmed === '.' || !AMOUNT_PATTERN.test(trimmed)) {
    throw new Error('Enter a valid decimal amount.')
  }

  const [whole = '', fraction = ''] = trimmed.split('.')
  const integerPart = whole.replace(/^0+(?=\d)/, '') || '0'
  const fractionPart = fraction.slice(0, 7).replace(/0+$/, '')
  const normalized = fractionPart ? `${integerPart}.${fractionPart}` : integerPart

  if (normalized === '0') throw new Error('Enter an amount greater than 0.')
  return normalized
}

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`
}

export function explorerAccountUrl(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 3) return address
  return `${address.slice(0, size)}...${address.slice(-size)}`
}

export interface AccountBalance {
  /** Native XLM balance as a string, "0" when the account is not funded yet. */
  xlm: string
  /** Horizon only knows accounts that exist on-chain and hold the base reserve. */
  funded: boolean
}

export async function getXlmBalance(address: string): Promise<AccountBalance> {
  try {
    const account = await server.accounts().accountId(address).call()
    const native = account.balances.find((b) => b.asset_type === 'native')
    return { xlm: native?.balance ?? '0', funded: true }
  } catch (error) {
    if (isNotFound(error)) return { xlm: '0', funded: false }
    throw new Error(`Could not reach Horizon: ${describeError(error)}`)
  }
}

/** Testnet faucet — gives the account 10,000 XLM so it can pay for fees. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`)
  if (response.ok) return

  const body = await response.json().catch(() => null)
  const detail = body?.detail ?? body?.title ?? `HTTP ${response.status}`
  if (String(detail).toLowerCase().includes('createaccountalreadyexist')) {
    throw new Error('This account is already funded.')
  }
  throw new Error(`Friendbot could not fund the account: ${detail}`)
}

async function accountExists(address: string): Promise<boolean> {
  try {
    await server.accounts().accountId(address).call()
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

export interface PaymentRequest {
  source: string
  destination: string
  amount: string
  memo?: string
}

/**
 * Builds an unsigned payment transaction as XDR.
 *
 * Stellar has no "send to a non-existent account" payment: the destination must
 * already hold the base reserve. When it does not, the transfer has to be a
 * createAccount operation instead, so we pick the right one here.
 */
export async function buildPaymentXdr({
  source,
  destination,
  amount: rawAmount,
  memo,
}: PaymentRequest): Promise<string> {
  const amount = normalizeAmount(rawAmount)

  const account = await server.loadAccount(source).catch((error) => {
    if (isNotFound(error)) {
      throw new Error('Your account is not funded yet. Use the faucet button first.')
    }
    throw error
  })

  const destinationExists = await accountExists(destination)
  if (!destinationExists && Number(amount) < MIN_CREATE_ACCOUNT_XLM) {
    throw new Error(
      `${destination.slice(0, 6)}... is a new account, so the first transfer must be at least ${MIN_CREATE_ACCOUNT_XLM} XLM.`,
    )
  }

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })

  builder.addOperation(
    destinationExists
      ? Operation.payment({ destination, asset: Asset.native(), amount })
      : Operation.createAccount({ destination, startingBalance: amount }),
  )

  if (memo?.trim()) builder.addMemo(Memo.text(memo.trim()))

  return builder.setTimeout(180).build().toXDR()
}

export interface SubmitResult {
  hash: string
  ledger: number
}

export async function submitSignedXdr(signedXdr: string): Promise<SubmitResult> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  try {
    const response = await server.submitTransaction(transaction)
    return { hash: response.hash, ledger: response.ledger }
  } catch (error) {
    throw new Error(describeSubmitError(error))
  }
}

function isNotFound(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === 404 || (error as { name?: string })?.name === 'NotFoundError'
}

/** Horizon returns machine-readable result codes; turn them into plain English. */
function describeSubmitError(error: unknown): string {
  const extras = (error as { response?: { data?: { extras?: ResultCodes } } })?.response?.data
    ?.extras
  const transactionCode = extras?.result_codes?.transaction
  const operationCode = extras?.result_codes?.operations?.[0]

  const code = operationCode ?? transactionCode
  switch (code) {
    case 'op_underfunded':
    case 'tx_insufficient_balance':
      return 'Not enough XLM: remember 1 XLM stays locked as the account reserve, plus the network fee.'
    case 'op_no_destination':
      return 'The destination account does not exist on testnet.'
    case 'op_low_reserve':
      return `A new account needs at least ${MIN_CREATE_ACCOUNT_XLM} XLM to be created.`
    case 'tx_bad_seq':
      return 'Sequence number was stale. Refresh the balance and try again.'
    case 'tx_too_late':
      return 'The transaction expired before it reached the network. Try again.'
    case 'tx_bad_auth':
      return 'The signature was rejected. Make sure Freighter is on Testnet.'
    default:
      return code ? `Transaction failed (${code}).` : describeError(error)
  }
}

interface ResultCodes {
  result_codes?: { transaction?: string; operations?: string[] }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong.'
}
