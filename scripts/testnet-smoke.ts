import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk'

import {
  NETWORK_PASSPHRASE,
  buildPaymentXdr,
  fundWithFriendbot,
  getXlmBalance,
  isValidAddress,
  normalizeAmount,
  submitSignedXdr,
} from '../src/lib/stellar'

const sender = Keypair.random()
const receiver = Keypair.random()

const log = (label: string, value: unknown) => console.log(`  ${label}:`, value)

async function main() {
  console.log('1. address validation')
  log('sender valid', isValidAddress(sender.publicKey()))
  log('garbage valid', isValidAddress('not-a-key'))

  console.log('2. amount normalization')
  for (const input of ['1.', '.5', '007.50', '1.23456789', '2']) {
    log(`"${input}"`, normalizeAmount(input))
  }
  for (const input of ['0', '0.0000000', 'abc', '']) {
    try {
      normalizeAmount(input)
      log(`"${input}"`, 'ACCEPTED (should have been rejected)')
    } catch (error) {
      log(`"${input}" rejected`, (error as Error).message)
    }
  }

  console.log('3. balance before funding')
  log('sender', await getXlmBalance(sender.publicKey()))

  console.log('4. friendbot')
  await fundWithFriendbot(sender.publicKey())
  log('sender', await getXlmBalance(sender.publicKey()))

  console.log('5. build + sign + submit (createAccount path - new destination)')
  const xdr = await buildPaymentXdr({
    source: sender.publicKey(),
    destination: receiver.publicKey(),
    amount: '25',
    memo: 'level 1 test',
  })
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE)
  tx.sign(sender)
  const result = await submitSignedXdr(tx.toXDR())
  log('hash', result.hash)
  log('ledger', result.ledger)
  log('receiver balance', await getXlmBalance(receiver.publicKey()))

  console.log('6. second payment (payment path - existing destination, loose "1." input)')
  const xdr2 = await buildPaymentXdr({
    source: sender.publicKey(),
    destination: receiver.publicKey(),
    amount: '1.',
  })
  const tx2 = TransactionBuilder.fromXDR(xdr2, NETWORK_PASSPHRASE)
  tx2.sign(sender)
  log('hash', (await submitSignedXdr(tx2.toXDR())).hash)
  log('receiver balance', await getXlmBalance(receiver.publicKey()))

  console.log('7. error mapping - overspend')
  const xdr3 = await buildPaymentXdr({
    source: sender.publicKey(),
    destination: receiver.publicKey(),
    amount: '99999',
  })
  const tx3 = TransactionBuilder.fromXDR(xdr3, NETWORK_PASSPHRASE)
  tx3.sign(sender)
  await submitSignedXdr(tx3.toXDR()).catch((error) => log('mapped error', error.message))

  console.log('8. error mapping - new account below reserve')
  await buildPaymentXdr({
    source: sender.publicKey(),
    destination: Keypair.random().publicKey(),
    amount: '0.5',
  }).catch((error) => log('mapped error', error.message))
}

main().catch((error) => {
  console.error('FAILED:', error)
  process.exit(1)
})
