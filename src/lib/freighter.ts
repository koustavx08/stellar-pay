import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api'

import { NETWORK, NETWORK_PASSPHRASE } from './stellar'

const FREIGHTER_DOWNLOAD_URL = 'https://www.freighter.app/'

export class FreighterError extends Error {
  hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'FreighterError'
    this.hint = hint
  }
}

/** The extension injects itself asynchronously, so this can be false on a cold load. */
export async function isFreighterInstalled(): Promise<boolean> {
  const { isConnected: installed } = await isConnected()
  return Boolean(installed)
}

async function assertInstalled(): Promise<void> {
  if (await isFreighterInstalled()) return
  throw new FreighterError(
    'Freighter wallet was not detected in this browser.',
    `Install it from ${FREIGHTER_DOWNLOAD_URL} and reload the page.`,
  )
}

export interface WalletSession {
  address: string
  network: string
}

/** Prompts the user to approve this site. Throws if they reject the popup. */
export async function connectWallet(): Promise<WalletSession> {
  await assertInstalled()

  const access = await requestAccess()
  if (access.error) throw new FreighterError(normalize(access.error))
  if (!access.address) throw new FreighterError('Freighter did not return an address.')

  return { address: access.address, network: await readNetwork() }
}

/**
 * Reads the address without prompting. Returns null when the user has not
 * approved this site yet, which is what we want on a page refresh.
 */
export async function restoreSession(): Promise<WalletSession | null> {
  if (!(await isFreighterInstalled())) return null

  const allowed = await isAllowed()
  if (!allowed.isAllowed) return null

  const { address, error } = await getAddress()
  if (error || !address) return null

  return { address, network: await readNetwork() }
}

async function readNetwork(): Promise<string> {
  const { network, error } = await getNetwork()
  if (error) throw new FreighterError(normalize(error))
  return network ?? 'UNKNOWN'
}

export function isTestnet(network: string): boolean {
  return network.toUpperCase() === NETWORK
}

export async function signXdr(xdr: string, address: string): Promise<string> {
  const { signedTxXdr, error } = await signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  })

  if (error) throw new FreighterError(normalize(error))
  if (!signedTxXdr) throw new FreighterError('Freighter returned an empty signature.')
  return signedTxXdr
}

/** Freighter surfaces errors as strings or objects depending on the call. */
function normalize(error: unknown): string {
  const message =
    typeof error === 'string' ? error : ((error as { message?: string })?.message ?? String(error))

  if (/user (declined|rejected)|denied/i.test(message)) {
    return 'Request rejected in Freighter.'
  }
  return message
}
