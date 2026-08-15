/**
 * Deploys the Tip Jar contract to the Stellar testnet.
 *
 * Runs the three steps the Stellar CLI would otherwise do for us, using only
 * the JS SDK so the repo needs no extra tooling:
 *   1. upload the compiled wasm and get its hash
 *   2. instantiate a contract from that hash
 *   3. call initialize() to set the owner and the accepted token
 *
 * The resulting contract id is written to deployment.json, which the frontend
 * imports. Re-running this deploys a *new* contract; that is intentional, so a
 * bad deploy never silently overwrites a good one in place.
 *
 * Usage:  npm run contract:deploy -- --owner G...
 *
 * The owner is the only address that can withdraw, so it should normally be a
 * wallet you control rather than the throwaway that paid for the deploy. Pass
 * --owner (or set STELLAR_OWNER_ADDRESS); it defaults to the deployer.
 *
 * Set STELLAR_DEPLOYER_SECRET to reuse an existing account, otherwise a fresh
 * testnet account is generated and funded by Friendbot.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  rpc,
  xdr,
  type Transaction,
} from '@stellar/stellar-sdk'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const WASM_PATH = resolve(root, 'contracts/target/wasm32v1-none/release/tip_jar.wasm')
const OUTPUT_PATH = resolve(root, 'deployment.json')

const server = new rpc.Server(RPC_URL)

async function main(): Promise<void> {
  const wasm = readFileSync(WASM_PATH)
  console.log(`wasm: ${WASM_PATH} (${wasm.length} bytes)`)

  const deployer = await resolveDeployer()
  console.log(`deployer: ${deployer.publicKey()}`)

  const owner = resolveOwner(deployer.publicKey())
  console.log(
    `owner:    ${owner}${owner === deployer.publicKey() ? '  (defaulted to the deployer)' : ''}`,
  )

  // Native XLM reaches contracts through its Stellar Asset Contract, whose
  // address is derived from the asset and the network, not deployed by us.
  const tokenId = Asset.native().contractId(NETWORK_PASSPHRASE)
  console.log(`native XLM SAC: ${tokenId}`)

  console.log('\n1. upload wasm')
  const wasmHash = hash(wasm)
  const uploadTx = await send(
    deployer,
    Operation.uploadContractWasm({ wasm }),
    'uploadContractWasm',
  )
  console.log(`   hash:     ${wasmHash.toString('hex')}`)
  console.log(`   tx:       ${uploadTx.hash}`)

  console.log('\n2. create contract instance')
  const createResult = await send(
    deployer,
    Operation.createCustomContract({
      address: Address.fromString(deployer.publicKey()),
      wasmHash,
      salt: randomBytes(32),
    }),
    'createCustomContract',
  )
  const contractId = Address.fromScVal(requireReturn(createResult)).toString()
  console.log(`   contract: ${contractId}`)
  console.log(`   tx:       ${createResult.hash}`)

  console.log('\n3. initialize(owner, token)')
  const contract = new Contract(contractId)
  const initResult = await send(
    deployer,
    contract.call(
      'initialize',
      Address.fromString(owner).toScVal(),
      Address.fromString(tokenId).toScVal(),
    ),
    'initialize',
  )
  console.log(`   tx:       ${initResult.hash}`)

  const deployment = {
    network: 'testnet',
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    contractId,
    wasmHash: wasmHash.toString('hex'),
    tokenId,
    owner,
    deployer: deployer.publicKey(),
    deployedAt: new Date().toISOString(),
    transactions: {
      upload: uploadTx.hash,
      create: createResult.hash,
      initialize: initResult.hash,
    },
  }
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(deployment, null, 2)}\n`)

  console.log(`\nwrote ${OUTPUT_PATH}`)
  console.log(`explorer: https://stellar.expert/explorer/testnet/contract/${contractId}`)
}

/**
 * The owner is stored on-chain and gates `withdraw`, so a typo here would mean
 * a jar nobody can empty. Validate the key rather than letting a malformed
 * address fail deep inside the initialize call.
 */
function resolveOwner(fallback: string): string {
  const flagIndex = process.argv.indexOf('--owner')
  const fromFlag = flagIndex === -1 ? undefined : process.argv[flagIndex + 1]
  const requested = (fromFlag ?? process.env.STELLAR_OWNER_ADDRESS ?? '').trim()

  if (!requested) return fallback
  if (!StrKey.isValidEd25519PublicKey(requested)) {
    throw new Error(`--owner must be a Stellar public key starting with G, got: ${requested}`)
  }

  return requested
}

async function resolveDeployer(): Promise<Keypair> {
  const secret = process.env.STELLAR_DEPLOYER_SECRET
  if (secret) {
    const keypair = Keypair.fromSecret(secret)
    await server.getAccount(keypair.publicKey())
    return keypair
  }

  const keypair = Keypair.random()
  console.log('no STELLAR_DEPLOYER_SECRET set, generating and funding a testnet account')
  console.log(`  secret: ${keypair.secret()}  <- save this to redeploy or withdraw`)

  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(keypair.publicKey())}`)
  if (!response.ok) throw new Error(`friendbot failed: HTTP ${response.status}`)

  // Friendbot answers as soon as Horizon accepts the transaction, but the
  // Soroban RPC server indexes ledgers independently and can still 404 for a
  // moment, so wait until it actually sees the account.
  await waitForAccount(keypair.publicKey())

  return keypair
}

async function waitForAccount(address: string): Promise<void> {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      await server.getAccount(address)
      return
    } catch {
      await new Promise((done) => setTimeout(done, 1000))
    }
  }

  throw new Error(`Soroban RPC never saw the funded account ${address}`)
}

interface SendResult {
  hash: string
  returnValue?: xdr.ScVal
}

/** Simulates, signs, submits and waits for a single Soroban operation. */
async function send(
  signer: Keypair,
  operation: xdr.Operation,
  label: string,
): Promise<SendResult> {
  const account = await server.getAccount(signer.publicKey())
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build()

  // prepareTransaction simulates the call and writes the resulting footprint,
  // resource fees and auth entries back into the transaction.
  let prepared: Transaction
  try {
    prepared = await server.prepareTransaction(built)
  } catch (error) {
    throw new Error(`${label}: simulation failed - ${describe(error)}`)
  }

  prepared.sign(signer)
  const sent = await server.sendTransaction(prepared)
  if (sent.status === 'ERROR') {
    throw new Error(`${label}: submission rejected - ${JSON.stringify(sent.errorResult)}`)
  }
  if (sent.status === 'TRY_AGAIN_LATER') {
    throw new Error(`${label}: RPC is congested and asked us to retry - rerun the deploy`)
  }

  return { hash: sent.hash, returnValue: await awaitResult(sent.hash, label) }
}

async function awaitResult(txHash: string, label: string): Promise<xdr.ScVal | undefined> {
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    const result = await server.getTransaction(txHash)

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return result.returnValue
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${label}: transaction failed on-chain - ${txHash}`)
    }

    await new Promise((done) => setTimeout(done, 1500))
  }

  throw new Error(`${label}: timed out waiting for ${txHash}`)
}

function requireReturn(result: SendResult): xdr.ScVal {
  if (!result.returnValue) throw new Error(`expected a return value from ${result.hash}`)
  return result.returnValue
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return JSON.stringify(error)
}

main().catch((error) => {
  console.error(`\ndeploy failed: ${describe(error)}`)
  process.exit(1)
})
