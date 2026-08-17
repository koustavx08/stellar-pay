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
 *
 * Zero is allowed here — this is a format conversion, not a transfer rule. Use
 * [`normalizeAmount`] when the value is something the user is trying to send.
 */
export function normalizeDecimal(input: string): string {
  const trimmed = input.trim()
  if (!trimmed || trimmed === '.' || !AMOUNT_PATTERN.test(trimmed)) {
    throw new Error('Enter a valid decimal amount.')
  }

  const [whole = '', fraction = ''] = trimmed.split('.')
  const integerPart = whole.replace(/^0+(?=\d)/, '') || '0'
  const fractionPart = fraction.slice(0, 7).replace(/0+$/, '')

  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart
}

/** An amount to actually transfer, so zero is rejected on top of the format rules. */
export function normalizeAmount(input: string): string {
  const normalized = normalizeDecimal(input)
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

/** Contracts count in stroops (1 XLM = 10^7), so conversions use BigInt, never floats. */
export const STROOPS_PER_XLM = 10_000_000n

export function toStroops(xlm: string): bigint {
  const [whole, fraction = ''] = normalizeDecimal(xlm).split('.')
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, '0'))
}

export function fromStroops(stroops: bigint | string | number): string {
  const value = BigInt(stroops)
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value

  const whole = absolute / STROOPS_PER_XLM
  const fraction = (absolute % STROOPS_PER_XLM).toString().padStart(7, '0').replace(/0+$/, '')

  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
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

/* Payment history ---------------------------------------------------------- */

export type PaymentDirection = 'sent' | 'received'

export interface PaymentRecord {
  /** Horizon's operation id — unique, and what the detail route is keyed on. */
  id: string
  direction: PaymentDirection
  /** 'payment' for a normal transfer, 'create_account' when it funded a new account. */
  kind: 'payment' | 'create_account'
  /** Native XLM amount as a decimal string. */
  amount: string
  /** The other party: who we paid, or who paid us. */
  counterparty: string
  from: string
  to: string
  hash: string
  createdAt: string
  /** Non-native assets are listed but flagged, since this app only sends XLM. */
  assetCode: string
}

/**
 * Recent XLM payments for an account, newest first.
 *
 * Horizon exposes payments as *operations*, so a single transaction with
 * several payments yields several records. That is the honest representation
 * of what happened on-chain, so it is what we show.
 */
export async function getPaymentHistory(
  address: string,
  limit = 50,
): Promise<PaymentRecord[]> {
  try {
    const page = await server.payments().forAccount(address).order('desc').limit(limit).call()

    return page.records
      .map((record) => toPaymentRecord(record, address))
      .filter((record): record is PaymentRecord => record !== null)
  } catch (error) {
    // An account that has never been funded has no history rather than an error.
    if (isNotFound(error)) return []
    throw new Error(`Could not load transaction history: ${describeError(error)}`)
  }
}

/** Looks up one payment operation by its Horizon operation id. */
export async function getPaymentById(
  id: string,
  address: string,
): Promise<PaymentRecord | null> {
  try {
    const record = await server.operations().operation(id).call()
    return toPaymentRecord(record as HorizonPaymentLike, address)
  } catch (error) {
    if (isNotFound(error)) return null
    throw new Error(`Could not load the transaction: ${describeError(error)}`)
  }
}

/** Ledger and fee live on the transaction, not the operation. */
export interface TransactionDetail {
  ledger: number
  feeCharged: string
  memo?: string
  successful: boolean
}

export async function getTransactionDetail(hash: string): Promise<TransactionDetail | null> {
  try {
    const tx = await server.transactions().transaction(hash).call()
    return {
      ledger: tx.ledger_attr,
      feeCharged: tx.fee_charged?.toString() ?? '0',
      memo: tx.memo,
      successful: tx.successful,
    }
  } catch (error) {
    if (isNotFound(error)) return null
    return null
  }
}

interface HorizonPaymentLike {
  id: string
  type: string
  transaction_hash: string
  created_at: string
  from?: string
  to?: string
  amount?: string
  asset_type?: string
  asset_code?: string
  funder?: string
  account?: string
  starting_balance?: string
}

/**
 * Horizon models `create_account` and `payment` with different field names, so
 * both are normalised into one shape the UI can render uniformly.
 */
function toPaymentRecord(raw: HorizonPaymentLike, viewer: string): PaymentRecord | null {
  if (raw.type === 'create_account') {
    const from = raw.funder ?? ''
    const to = raw.account ?? ''
    const direction: PaymentDirection = from === viewer ? 'sent' : 'received'
    return {
      id: raw.id,
      direction,
      kind: 'create_account',
      amount: raw.starting_balance ?? '0',
      counterparty: direction === 'sent' ? to : from,
      from,
      to,
      hash: raw.transaction_hash,
      createdAt: raw.created_at,
      assetCode: 'XLM',
    }
  }

  if (raw.type === 'payment') {
    const from = raw.from ?? ''
    const to = raw.to ?? ''
    const direction: PaymentDirection = from === viewer ? 'sent' : 'received'
    return {
      id: raw.id,
      direction,
      kind: 'payment',
      amount: raw.amount ?? '0',
      counterparty: direction === 'sent' ? to : from,
      from,
      to,
      hash: raw.transaction_hash,
      createdAt: raw.created_at,
      assetCode: raw.asset_type === 'native' ? 'XLM' : (raw.asset_code ?? 'unknown'),
    }
  }

  // Other operation types (trustlines, contract invocations) are not payments
  // and are deliberately left out rather than guessed at.
  return null
}

export function formatXlmAmount(value: string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 7 })
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatTimestamp(iso)
}
