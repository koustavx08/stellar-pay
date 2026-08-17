# Screenshots

The main README expects these files. Capture them from the live site
(<https://stellar-pay-omega.vercel.app>) or locally with `npm run dev`, using
Freighter connected on **Testnet**. Then delete this file and `.gitkeep`.

Use a desktop window around **1280×800**, and capture the content area rather
than the whole screen — browser chrome and bookmarks bars date the images.

| Filename | Route | What to capture |
| --- | --- | --- |
| `01-landing.png` | `/` | The hero: headline, Connect Wallet button and the balance preview card |
| `02-wallet-connected.png` | `/dashboard` | The dashboard with the wallet menu open in the top right, showing the shortened address and Testnet badge |
| `03-balance.png` | `/dashboard` | The balance card with the XLM amount and the spendable / reserve line, plus the quick actions row |
| `04-send-payment.png` | `/send` | The review step with amount, recipient and fee — ideally with the Freighter signing popup visible |
| `05-transaction-result.png` | `/send` | The success panel with the transaction hash and the Stellar Expert link |
| `06-activity.png` | `/activity` | The transaction list grouped by date |
| `07-tip-jar.png` | `/tip-jar` | The contract stats and the tip form |

The Level 1 submission specifically asks for four things — a connected wallet,
a displayed balance, a testnet transaction being sent, and the result shown to
the user. Files `02` through `05` cover those, so capture at least those four
if you are short on time.

## Mobile (optional)

A couple of shots at 375px wide show the responsive layout off well —
`/dashboard` and `/send` are the most convincing, since the bottom tab bar and
the stacked form are both visible.
