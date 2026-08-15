# Stellar Pay — Testnet Payment dApp

> ⚪️ **Stellar Frontend Challenge — Level 1 (White Belt)**

A React + TypeScript dApp that connects a [Freighter](https://www.freighter.app/) wallet, reads the
account's XLM balance from Horizon, and sends real payments on the **Stellar Testnet** — with clear
success / failure feedback and a link to the transaction on the block explorer.

It also ships a **Soroban smart contract** written in Rust and deployed to testnet: a tip jar that
holds XLM and records who tipped what. So the app demonstrates both halves of Stellar — classic
payments through Horizon, and contract invocation through Soroban RPC.

No real funds are ever involved: everything runs against testnet and accounts are funded by the
Friendbot faucet.

---

## ✨ Features

| Requirement | How it is covered |
| --- | --- |
| **Wallet setup** | Freighter extension, network locked to Testnet — the UI warns and disables sending if the wallet is on any other network |
| **Wallet connect** | `requestAccess()` prompts Freighter; an already-approved session is restored silently on reload |
| **Wallet disconnect** | Clears the local session, stops all wallet reads, and is remembered across reloads so the app does not silently re-connect |
| **Balance fetch** | Native XLM balance read from Horizon, with unfunded accounts detected and a one-click Friendbot faucet |
| **Balance display** | Large balance card that also shows the *spendable* amount (balance − 1 XLM base reserve) |
| **Send XLM** | Builds a payment transaction, signs it in Freighter, submits it to Horizon |
| **Transaction feedback** | Live stage labels (building → waiting for signature → submitting), then a success panel with the **transaction hash**, ledger number and a Stellar Expert link — or a plain-English failure message |
| **Error handling** | Input validation, Horizon result codes translated to readable text, rejected signatures, missing extension, wrong network |
| **Smart contract** | A Rust/Soroban tip jar deployed to testnet — reads via RPC simulation, tips signed through Freighter, contract error codes mapped to plain English |

Two details worth calling out:

- **New destinations are handled correctly.** Stellar cannot `payment` into an account that does not
  exist yet, so the app checks the destination and switches to a `createAccount` operation, enforcing
  the 1 XLM minimum. This is the failure most Level 1 submissions hit.
- **Reserve-aware amounts.** The "Max" button and validation subtract the 1 XLM base reserve and a fee
  buffer, so a valid-looking amount does not fail on-chain with `op_underfunded`.
- **Amounts are normalised as text, not floats.** The SDK rejects loose input like `1.` or `.5`, and
  parsing to a JS number loses precision at stroop scale, so `normalizeAmount` trims to 7 fractional
  digits purely as a string.

---

## 📜 The smart contract

Beyond the classic payment flow, the app talks to a **Soroban smart contract** written in Rust and
deployed to testnet: a tip jar that holds XLM and remembers who gave what.

Source: [`contracts/tip-jar/src/lib.rs`](contracts/tip-jar/src/lib.rs)

| | |
| --- | --- |
| **Contract ID** | [`CC7VERBCH4QPKDTUCN7TOJGJT5XGL5WP5WYIYPJ6QISHHTEESYKJMKOO`](https://stellar.expert/explorer/testnet/contract/CC7VERBCH4QPKDTUCN7TOJGJT5XGL5WP5WYIYPJ6QISHHTEESYKJMKOO) |
| **Network** | Stellar Testnet |
| **Token** | Native XLM Stellar Asset Contract (`CDLZFC3S…CYSC`) |
| **Wasm hash** | `8d903ba4d9844d4a54f17441e21f39d41237e6744d85c4f0a14d1eee101646f4` |
| **Wasm size** | 14,674 bytes |

Deploy transactions:
[upload](https://stellar.expert/explorer/testnet/tx/7bc331039439748a58ef591b2dfae640f183224a54cd2cd5d42c2e8b14feecf8) ·
[create](https://stellar.expert/explorer/testnet/tx/c5d433bedeee5c9cbf4d64935c51f39c1fe103678caedfa6f967acafa35ca4c6) ·
[initialize](https://stellar.expert/explorer/testnet/tx/fc18739b5058fd10492e894e3681a8755da4214e67de94148876ccaecbe97e1c)

### What it does

| Function | Auth | Purpose |
| --- | --- | --- |
| `initialize(owner, token)` | — | Sets the owner and accepted token. Callable once. |
| `tip(from, amount, message)` | `from` | Pulls `amount` from the tipper into the jar and records it. |
| `withdraw(to)` | `owner` | Sends the jar's whole balance to `to`. |
| `total_tips()` · `tip_count()` · `tips_by(who)` · `last_message()` · `balance()` | — | Read-only views. |

### Design notes

- **It never touches raw XLM.** Contracts cannot move native XLM directly — it reaches them through
  the *Stellar Asset Contract*. The jar talks to the standard token interface, so it works with any
  SEP-41 token; testnet XLM's SAC is just the address it happens to be initialised with.
- **`from.require_auth()` is the whole security model.** The transfer debits the tipper, so the
  contract must prove that exact call was authorised. Without that line anyone could drain anyone.
  Because the tipper is also the transaction source, Soroban accepts the transaction signature as
  that authorisation — so Freighter signs once and there is no separate auth entry.
- **Funds move before the books are written.** The transfer runs first; if the tipper cannot cover it
  the whole invocation reverts, so the counters can never record a tip that did not settle.
- **Storage is split by lifetime.** Totals and the last message live in instance storage; per-tipper
  balances live in persistent storage with their TTL bumped on write, so a busy tipper's record does
  not expire out from under them.

### Reading and writing from the frontend

Reads ([`src/lib/tipjar.ts`](src/lib/tipjar.ts)) go through `simulateTransaction` — the RPC server
runs the call in a sandbox and returns the value, so views cost nothing and need no signature. Writes
are built, simulated to fill in the footprint and resource fees, signed by Freighter, then submitted
and polled to completion.

---

## 🖼️ Screenshots

| Wallet connected | Balance displayed |
| --- | --- |
| ![Wallet connected](screenshots/01-wallet-connected.png) | ![Balance displayed](screenshots/02-balance.png) |

| Sending a testnet transaction | Transaction result shown to the user |
| --- | --- |
| ![Sending a payment](screenshots/03-send-payment.png) | ![Transaction result](screenshots/04-transaction-result.png) |

---

## 🌐 Deploying the frontend

The app is a static Vite build, so any static host works. [`vercel.json`](vercel.json) is already
configured (build command, output directory, SPA rewrites, asset caching).

To put it on Vercel:

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Import the `stellar-pay` repository.
3. Leave every setting at its default — `vercel.json` supplies them.
4. Click **Deploy**.

No environment variables are needed: the network is testnet and the contract address ships in
[`deployment.json`](deployment.json).

Prefer the CLI?

```bash
npx vercel --prod
```

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Rust** + [`soroban-sdk`](https://docs.rs/soroban-sdk) — the on-chain Tip Jar contract
- [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) — transaction building, Horizon queries and Soroban RPC
- [`@stellar/freighter-api`](https://github.com/stellar/freighter) — wallet connection and signing
- Plain CSS (no UI framework)

Network configuration lives in one place, [`src/lib/stellar.ts`](src/lib/stellar.ts):

| Setting | Value |
| --- | --- |
| Horizon | `https://horizon-testnet.stellar.org` |
| Friendbot | `https://friendbot.stellar.org` |
| Passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |

---

## 🚀 Setup — run it locally

### 1. Prerequisites

- **Node.js 18+** and npm
- The **Freighter** browser extension — <https://www.freighter.app/>

### 2. Prepare the wallet

1. Install Freighter and create (or import) a wallet.
2. Open Freighter → network selector → choose **Testnet**.
3. Copy your public key (it starts with `G…`).

### 3. Install and run

```bash
git clone https://github.com/koustavx08/stellar-pay.git
cd stellar-pay
npm install
npm run dev
```

Open <http://localhost:5173>.

### 4. Use the dApp

1. Click **Connect Freighter** and approve the popup.
2. If the account is new, click **Fund with Friendbot** — you get 10,000 test XLM.
3. Paste a destination address, enter an amount, add an optional memo, and hit **Send payment**.
4. Approve the transaction in Freighter. The hash and explorer link appear as soon as it lands.

> Need a second address to send to? Generate one at
> <https://lab.stellar.org/account/create> — or just send to any `G…` testnet key.

### Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run smoke` | End-to-end testnet check of the transaction logic (see below) |
| `npm run contract:test` | Run the Soroban contract's Rust unit tests |
| `npm run contract:build` | Compile the contract to `wasm32v1-none` |
| `npm run contract:deploy` | Upload, instantiate and initialise the contract on testnet |

---

## ✅ Verifying the contract

`npm run contract:test` runs the contract against the real Soroban host environment:

```
running 12 tests
test test::initialize_is_only_callable_once ... ok
test test::initialize_sets_owner_and_token ... ok
test test::tip_emits_an_event ... ok
test test::owner_can_withdraw_everything ... ok
test test::tip_fails_when_the_tipper_cannot_cover_it ... ok
test test::tip_moves_funds_and_records_the_tipper ... ok
test test::tip_rejects_an_oversized_message ... ok
test test::tip_requires_the_tipper_to_authorize ... ok
test test::tip_rejects_non_positive_amounts ... ok
test test::withdraw_rejects_an_empty_jar ... ok
test test::withdraw_requires_the_owner_signature ... ok
test test::tips_accumulate_per_address ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Two of those matter more than the rest: `tip_requires_the_tipper_to_authorize` and
`withdraw_requires_the_owner_signature` run with auth mocking **switched off**, so they prove the
`require_auth` guards actually hold rather than being mocked away. And
`tip_fails_when_the_tipper_cannot_cover_it` checks that a failed transfer reverts the counters too,
instead of recording a tip that never settled.

Unit tests only prove the logic against a simulated host. `npm run contract:verify` proves the
contract **actually deployed on testnet** behaves the same — it funds a throwaway tipper, sends a
real tip through the contract, and checks the on-chain accounting moved:

```
1. read state before
  total tipped: 25 XLM
  tip count: 2
  jar balance: 25 XLM
2. fund a throwaway tipper
  tipper: GB2MZPJDLI35KV2PZHXAJ3CXURXQJ6NEN2VJTPXHJDK3TEMZYQPJYY4I
3. invoke tip() on the deployed contract
  tx hash: ef9aa2d490355ae7b3c29678e134cb65682e733f4f9ba75d8c1c8bf3c0519d2d
4. read state after
  total tipped: 37.5 XLM
  tip count: 3
  jar balance: 37.5 XLM
  last message: level 1 verification tip
  this tipper gave: 12.5 XLM
5. assertions
  PASS: total tips increased by the tip
  PASS: tip count incremented
  PASS: jar balance matches the tip
  PASS: message stored on-chain
  PASS: per-tipper total recorded
6. contract rejects a zero tip, in plain English
  message shown to the user: Tip amount must be greater than 0.
  PASS: contract error code mapped to a readable message
```

That last check matters: the contract returns `Error(Contract, #3)`, and the point is that a user
never sees that — it is mapped back to the message the error code stands for.

---

## ✅ Verifying the transaction logic

`npm run smoke` exercises the whole on-chain path without the browser: it generates a throwaway
keypair, funds it with Friendbot, reads the balance, checks amount normalisation, builds/signs/submits
two payments, and confirms the error mapping produces readable messages.

```
1. address validation
  sender valid: true
  garbage valid: false
2. amount normalization
  "1.": 1
  ".5": 0.5
  "007.50": 7.5
  "1.23456789": 1.2345678
  "2": 2
  "0" rejected: Enter an amount greater than 0.
  "0.0000000" rejected: Enter an amount greater than 0.
  "abc" rejected: Enter a valid decimal amount.
  "" rejected: Enter a valid decimal amount.
3. balance before funding
  sender: { xlm: '0', funded: false }
4. friendbot
  sender: { xlm: '10000.0000000', funded: true }
5. build + sign + submit (createAccount path - new destination)
  hash: ac580da50bd4358104c5e50c76f5b9105ae92240bf743c61e63594603b43744b
  ledger: 4157174
  receiver balance: { xlm: '25.0000000', funded: true }
6. second payment (payment path - existing destination, loose "1." input)
  hash: 7e8f3501d7a64208347bad292acd9abc2e2f70252f76d8639505d2325895555c
  receiver balance: { xlm: '26.0000000', funded: true }
7. error mapping - overspend
  mapped error: Not enough XLM: remember 1 XLM stays locked as the account reserve, plus the network fee.
8. error mapping - new account below reserve
  mapped error: GD66GF... is a new account, so the first transfer must be at least 1 XLM.
```

Both transactions above are real and permanently viewable on testnet:
[`ac580da5…`](https://stellar.expert/explorer/testnet/tx/ac580da50bd4358104c5e50c76f5b9105ae92240bf743c61e63594603b43744b) ·
[`7e8f3501…`](https://stellar.expert/explorer/testnet/tx/7e8f3501d7a64208347bad292acd9abc2e2f70252f76d8639505d2325895555c)

---

## 📁 Project structure

```
contracts/
└── tip-jar/
    └── src/
        ├── lib.rs        # The Soroban contract: tip, withdraw, views, events
        └── test.rs       # 12 unit tests against the Soroban host
src/
├── lib/
│   ├── stellar.ts        # Horizon client, balance fetch, tx building, result-code → message mapping
│   ├── freighter.ts      # Wallet detection, connect, session restore, signing
│   └── tipjar.ts         # Contract client: RPC simulation for reads, invocation for writes
├── hooks/
│   ├── useWallet.ts      # Connect / disconnect + polls for address & network changes
│   ├── useBalance.ts     # Balance fetching with loading and error state
│   └── useTipJar.ts      # Contract stats with loading and error state
├── components/
│   ├── Header.tsx        # Brand, network badge, connect / disconnect
│   ├── Landing.tsx       # Pre-connection screen with setup steps
│   ├── WalletPanel.tsx   # Address, balance, faucet, explorer link
│   ├── PaymentForm.tsx   # Validation + send flow (classic payment)
│   ├── TipJarPanel.tsx   # Contract stats + tip flow (Soroban invocation)
│   ├── TxFeedback.tsx    # Success / failure panel with tx hash
│   ├── Alert.tsx         # Shared alert component
│   └── CopyButton.tsx    # Copy-to-clipboard control
├── App.tsx               # Layout and state wiring
└── styles.css
scripts/
├── testnet-smoke.ts      # End-to-end testnet check of the transaction logic
└── deploy-contract.ts    # Uploads, instantiates and initialises the contract
deployment.json           # Contract id and deploy transaction hashes
```

---

## 🧯 Troubleshooting

| Problem | Fix |
| --- | --- |
| "Freighter wallet was not detected" | Install the extension and reload the page — it injects itself after load |
| Header shows `PUBLIC` in yellow | Switch Freighter to Testnet; sending stays disabled until you do |
| "Your account is not funded yet" | Click **Fund with Friendbot** |
| "The destination account does not exist on testnet" | Send at least 1 XLM so the account gets created |
| "Not enough XLM…" | 1 XLM is permanently locked as the base reserve — use the **Max** button |
| Nothing happens after clicking send | Check the Freighter popup; it may be waiting behind the browser window |

---

## 📄 License

MIT
