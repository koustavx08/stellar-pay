# Stellar Pay — Testnet Payment dApp

> ⚪️ **Stellar Frontend Challenge — Level 1 (White Belt)**

A small React + TypeScript dApp that connects a [Freighter](https://www.freighter.app/) wallet,
reads the account's XLM balance from Horizon, and sends real payments on the **Stellar Testnet** —
with clear success / failure feedback and a link to the transaction on the block explorer.

No real funds are ever involved: everything runs against testnet and the account is funded by the
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

## 🖼️ Screenshots

| Wallet connected | Balance displayed |
| --- | --- |
| ![Wallet connected](screenshots/01-wallet-connected.png) | ![Balance displayed](screenshots/02-balance.png) |

| Sending a testnet transaction | Transaction result shown to the user |
| --- | --- |
| ![Sending a payment](screenshots/03-send-payment.png) | ![Transaction result](screenshots/04-transaction-result.png) |

---

## 🛠️ Tech Stack

- **React 19** + **TypeScript** + **Vite**
- [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) — transaction building and Horizon queries
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
  hash: 8248b170f3c08f092fbf36a1a9c25c41ccb36e833ed0db6a9b1b458cb8131a3b
  ledger: 3856595
  receiver balance: { xlm: '25.0000000', funded: true }
6. second payment (payment path - existing destination, loose "1." input)
  hash: 7368945f585ac7137ee9a68fc023fd518ec1c1d0d610f222a9c5737053654984
  receiver balance: { xlm: '26.0000000', funded: true }
7. error mapping - overspend
  mapped error: Not enough XLM: remember 1 XLM stays locked as the account reserve, plus the network fee.
8. error mapping - new account below reserve
  mapped error: GA27Y2... is a new account, so the first transfer must be at least 1 XLM.
```

Both transactions above are real and permanently viewable on testnet:
[`8248b170…`](https://stellar.expert/explorer/testnet/tx/8248b170f3c08f092fbf36a1a9c25c41ccb36e833ed0db6a9b1b458cb8131a3b) ·
[`7368945f…`](https://stellar.expert/explorer/testnet/tx/7368945f585ac7137ee9a68fc023fd518ec1c1d0d610f222a9c5737053654984)

---

## 📁 Project structure

```
src/
├── lib/
│   ├── stellar.ts       # Horizon client, balance fetch, tx building, result-code → message mapping
│   └── freighter.ts     # Wallet detection, connect, session restore, signing
├── hooks/
│   ├── useWallet.ts     # Connect / disconnect + polls for address & network changes
│   └── useBalance.ts    # Balance fetching with loading and error state
├── components/
│   ├── Header.tsx       # Brand, network badge, connect / disconnect
│   ├── Landing.tsx      # Pre-connection screen with setup steps
│   ├── WalletPanel.tsx  # Address, balance, faucet, explorer link
│   ├── PaymentForm.tsx  # Validation + send flow
│   ├── TxFeedback.tsx   # Success / failure panel with tx hash
│   ├── Alert.tsx        # Shared alert component
│   └── CopyButton.tsx   # Copy-to-clipboard control
├── App.tsx              # Layout and state wiring
└── styles.css
scripts/
└── testnet-smoke.ts     # End-to-end testnet check of the transaction logic
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
