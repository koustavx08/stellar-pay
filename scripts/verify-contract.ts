/**
 * End-to-end check of the *deployed* Tip Jar contract.
 *
 * Unit tests prove the logic against a simulated host; this proves the thing
 * actually on testnet behaves the same. It funds a throwaway tipper, sends a
 * real tip through the contract, and checks the on-chain accounting moved.
 *
 * Uses the same `src/lib/tipjar.ts` the browser uses — only the signing step
 * differs, because there is no Freighter here.
 */
import {
  Keypair,
  TransactionBuilder,
  type Transaction,
} from '@stellar/stellar-sdk'

import deployment from '../deployment.json'
import { fromStroops, toStroops } from '../src/lib/stellar'
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  buildTipXdr,
  readStats,
  readTipsBy,
  server,
  submitTip,
} from '../src/lib/tipjar'

const FRIENDBOT_URL = 'https://friendbot.stellar.org'
const TIP_AMOUNT = '12.5'
const TIP_MESSAGE = 'level 1 verification tip'

const log = (label: string, value: unknown) => console.log(`  ${label}:`, value)

async function main(): Promise<void> {
  console.log(`contract: ${CONTRACT_ID}`)
  console.log(`token:    ${deployment.tokenId}\n`)

  console.log('1. read state before')
  const before = await readStats()
  log('total tipped', `${before.totalTips} XLM`)
  log('tip count', before.tipCount)
  log('jar balance', `${before.balance} XLM`)

  console.log('\n2. fund a throwaway tipper')
  const tipper = await fundedKeypair()
  log('tipper', tipper.publicKey())

  console.log('\n3. invoke tip() on the deployed contract')
  const xdr = await buildTipXdr(tipper.publicKey(), TIP_AMOUNT, TIP_MESSAGE)
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE) as Transaction
  tx.sign(tipper)
  const { hash } = await submitTip(tx.toXDR())
  log('tx hash', hash)
  log('explorer', `https://stellar.expert/explorer/testnet/tx/${hash}`)

  console.log('\n4. read state after')
  const after = await readStats()
  const mine = await readTipsBy(tipper.publicKey())
  log('total tipped', `${after.totalTips} XLM`)
  log('tip count', after.tipCount)
  log('jar balance', `${after.balance} XLM`)
  log('last message', after.lastMessage)
  log('this tipper gave', `${mine} XLM`)

  console.log('\n5. assertions')
  const expectedTotal = toStroops(before.totalTips) + toStroops(TIP_AMOUNT)
  check('total tips increased by the tip', fromStroops(expectedTotal) === after.totalTips)
  check('tip count incremented', after.tipCount === before.tipCount + 1)
  check('jar balance matches the tip', after.balance === fromStroops(toStroops(before.balance) + toStroops(TIP_AMOUNT)))
  check('message stored on-chain', after.lastMessage === TIP_MESSAGE)
  check('per-tipper total recorded', mine === TIP_AMOUNT)

  console.log('\n6. contract rejects a zero tip, in plain English')
  await buildTipXdr(tipper.publicKey(), '0', 'nope')
    .then(() => check('zero tip rejected', false))
    .catch((error) => {
      const message = (error as Error).message
      log('message shown to the user', message)
      // Error #3 is InvalidAmount in the contract; the user must never see that.
      check('contract error code mapped to a readable message', message === ZERO_TIP_MESSAGE)
    })
}

const ZERO_TIP_MESSAGE = 'Tip amount must be greater than 0.'

function check(label: string, passed: boolean): void {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}: ${label}`)
  if (!passed) process.exitCode = 1
}

async function fundedKeypair(): Promise<Keypair> {
  const keypair = Keypair.random()
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(keypair.publicKey())}`)
  if (!response.ok) throw new Error(`friendbot failed: HTTP ${response.status}`)

  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      await server.getAccount(keypair.publicKey())
      return keypair
    } catch {
      await new Promise((done) => setTimeout(done, 1000))
    }
  }
  throw new Error('RPC never saw the funded tipper')
}

main().catch((error) => {
  console.error(`\nverification failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
