# ⬡ Architect Pay

> **Gasless stablecoin payroll, settled on Arc.**
> One USDC balance and one EURC balance. Deposit from any of six networks, pay anyone on any of them — the chains stay out of your way.

![Network](https://img.shields.io/badge/Network-Arc%20Mainnet-00e5a0?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Circle](https://img.shields.io/badge/Circle-SCA%20Wallets-0099ff?style=for-the-badge)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)

---

## What is Architect Pay?

Paying a distributed team in stablecoins normally means juggling a separate wallet, gas token and bridge for every chain your people want to be paid on. Architect Pay removes that entirely.

You see **one USDC balance and one EURC balance** — no networks, no per-chain wallets. Deposit from Arc, Base, Arbitrum, Optimism, Polygon or Avalanche and the funds consolidate onto Arc on their own. Add your employees, let each one pick the chain and token they want to be paid in, and hit **Run Payroll**: every payout leaves Arc and lands where that person asked for it.

Arc is the hub for a concrete reason. Circle quotes CCTP at **zero basis points outbound from Arc to every destination**, while routing chain-to-chain directly costs 1–1.3 bps a leg. Settling everything through Arc is simply the cheapest and fastest way to fan payments out.

Nobody — not you, not your employees — ever holds a native gas token. Every transaction is sponsored through Circle Gas Station.

---

## Live Demo

🌐 **[architectpay.website](https://architectpay.website)**

Running on **Arc mainnet**. Example settlements:

| Amount | Transaction |
|--------|-------------|
| 10.79 USDC | [`0xe18571b2…6e3cc52d`](https://explorer.arc.io/tx/0xe18571b2e38a7baa0bc33a315608dcd603f50b0cbd52e72b8cd062916e3cc52d) |
| 1.00 USDC | [`0xb099f312…b9d72ddf`](https://explorer.arc.io/tx/0xb099f31224ffe8450b953e6f3f787985c722a1384817d0ba06490d1ab9d72ddf) |

---

## Features

- **One Balance Per Token** — No chain pickers, no per-network balances; USDC and EURC, and that's the whole mental model
- **Automatic Settlement to Arc** — Deposits on any supported network consolidate onto Arc in the background, usually inside a minute
- **Per-Employee Chain & Token** — Each person picks where and in what they get paid; one run settles all of it
- **USDC and EURC** — Full support for both, including EURC bridging through Arc's CrossChainTokenService
- **Gasless Everywhere** — Circle Gas Station sponsors every transaction on every chain
- **Six Networks** — Arc, Base, Arbitrum, Optimism, Polygon, Avalanche
- **Self-Healing Settlement** — Payments survive bundler and paymaster failures without manual retry
- **Stablecoin Swaps** — Convert between USDC and EURC in-app
- **Username Payments** — Send to `@handle` instead of a 42-character address
- **Businesses & Scheduling** — Group employees by business, set a recurring payday
- **Full History** — Payments, withdrawals, received funds, payroll runs and swaps, with explorer links
- **SCA Wallets** — Every user gets a Circle smart contract wallet (ERC-4337), no seed phrases

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│       Browser · Architect Pay Next.js App · Circle Wallet   │
│                     (Deployed on Vercel)                    │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    ARC MAINNET — CIRCLE L1                  │
│         Chain ID: 5042 · Sub-second finality                │
│         Dollar-denominated fees · USDC & EURC native        │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Circle SCA   │  │  Circle CCTP V2  │  │  Neon PostgreSQL │
│  Wallets      │  │  6-chain USDC    │  │  Users, wallets  │
│  ERC-4337     │  │  + Arc CCTPx     │  │  employees, runs │
│  Gas Station  │  │  for EURC        │  │  Prisma ORM      │
└───────────────┘  └──────────────────┘  └──────────────────┘
                          │
   ┌──────────┬───────────┼───────────┬──────────┐
   ▼          ▼           ▼           ▼          ▼
  Arc       Base      Arbitrum   Optimism   Polygon
                                            Avalanche
```

---

## Circle Products Used

| Product | Usage |
|---------|-------|
| **Developer-Controlled SCA Wallets** | Every user gets a smart contract wallet — gasless, no seed phrase |
| **Gas Station** | Sponsors transaction fees on all six chains so nobody holds native tokens |
| **CCTP V2** | Cross-chain USDC settlement, with Arc as domain 26 in both directions |
| **Arc CrossChainTokenService (CCTPx)** | EURC bridging to and from Arc |
| **USDC & EURC on Arc** | Primary settlement assets |

---

## How Money Moves

```
Deposit on any supported network
        │
        ▼
Counted in your balance immediately — spendable right away
        │
        ▼
Swept onto Arc in the background (CCTP V2 / CCTPx)
   · triggered when a balance is read, with a daily cron as backstop
   · ~1 min for USDC · up to ~20 min for EURC (hard finality)
   · burn recorded before it confirms, so a slow bridge never strands funds
        │
        ▼
Every payout leaves Arc → 0 bps outbound to any destination
```

Sweeping is an optimisation, never a precondition. Funds are spendable the moment
they land, because the payment planner can still source from any chain — the sweep
just makes later payouts cheaper and faster.

---

## Fees

| | |
|---|---|
| Gas, every network | **Free** — sponsored by Circle Gas Station |
| Deposits | **Free**, no minimum |
| Swaps (USDC ↔ EURC) | **Free** |
| Transfers on Arc | **Free** |
| Transfers to another network | **0.01%**, minimum $0.01 |
| Payroll | **0.01% per payout** on non-Arc employees, min $0.01 each; Arc payouts free |
| Minimum withdrawal | **$1.00**, and only when leaving Arc |

Circle's CCTP also takes a small protocol fee on cross-chain transfers, deducted
from the amount sent.

---

## Payroll Flow

```
User clicks "Run Payroll"
        │
        ▼
1. Pre-flight — verify balances cover payroll + fees before spending gas
        │
        ▼
2. Aggregate — top the Arc hub up from any chain still holding a balance
        │
        ▼
3. Fan out — for each employee, by their chosen chain and token:
        │
        ├── Paid on Arc        → direct transfer, instant and free
        └── Paid anywhere else → CCTP burn from Arc, settled asynchronously
        │
        ▼
4. Settle — poll Iris for attestation, mint on the destination, pay the employee
        │
        ▼
5. Reconcile — update run status; retry anything still in flight
```

### Settlement Reliability

Cross-chain payroll fails in ways single-chain payroll does not, so settlement is built to survive them:

- **Non-blocking burns** — a payroll run submits burns and returns immediately; settlement is polled rather than held open
- **Relay fallback** — if Circle's bundler cannot execute the mint (gas estimation failure, paymaster policy limit), the system detects Circle's own CCTP relay completing it and pays out from the resulting balance, so a payment is never lost to a transient failure
- **Atomic claims** — concurrent settlement workers claim each entry with a conditional update, so an employee can never be paid twice
- **Stale-claim recovery** — a claim abandoned by a crashed process is reclaimed, and a drained receiver wallet is recognised as already-paid rather than paid again

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 App Router + React |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Wallets | Circle Developer-Controlled SCA Wallets (ERC-4337) |
| Cross-chain | Circle CCTP V2 + Arc CrossChainTokenService |
| Gas | Circle Gas Station |
| Database | Neon PostgreSQL + Prisma ORM |
| Auth | JWT (jose) + bcryptjs |
| Hosting | Vercel |
| Network | Arc mainnet (Circle L1) |

---

## Arc Mainnet Details

| Property | Value |
|----------|-------|
| Network Name | Arc |
| Chain ID | `5042` (0x13b2) |
| RPC URL | `https://rpc.mainnet.arc.io` |
| Block Explorer | `https://explorer.arc.io` |
| Gas Token | USDC |
| USDC | `0x3600000000000000000000000000000000000000` |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` |
| CCTP Domain | `26` |

---

## Running Locally

### Prerequisites
- Node.js v18+
- Circle API key and Entity Secret
- Neon PostgreSQL database URL

### Steps

```bash
# Clone the repo
git clone https://github.com/rifat98pro/Architect-Pay.git
cd Architect-Pay

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Circle and Neon credentials

# Push database schema
npx prisma db push

# Start the dev server
npm run dev

# Open in browser
http://localhost:3000
```

### Environment Variables

```
DATABASE_URL=your_neon_postgresql_url
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_entity_secret
JWT_SECRET=your_jwt_secret
```

> Credentials are read from the environment only — never commit them.

---

## Project Structure

```
architect-pay/
├── app/
│   ├── (auth)/              ← Login and signup pages
│   ├── (dashboard)/         ← Dashboard, payments, payroll, employees, history, swap
│   ├── api/                 ← API routes (payments, payroll, wallets, swap, auth)
│   └── page.tsx             ← Landing page
├── components/              ← Nav, logos, deposit modal
├── contracts/
│   └── ArchitectPay.sol     ← Event registry (see note below)
├── lib/
│   ├── circle.ts            ← Circle SDK wrapper
│   ├── cctp.ts              ← CCTP V2 burn/mint + EURC CCTPx
│   ├── cctp-chains.ts       ← Per-chain config: domains, tokens, fee levels
│   └── db.ts                ← Prisma client
├── prisma/
│   └── schema.prisma        ← Database schema
└── scripts/
    └── deploy-custom-contract.mjs ← Contract deployment script
```

> `contracts/ArchitectPay.sol` is an optional event registry from an earlier build. It is currently deployed on Arc testnet only; on-chain event logging is not active on mainnet. All payments settle as real USDC/EURC transfers regardless.

---

## Security Notes

- Entity secrets and API keys are read from server-side environment variables only, never exposed to the browser
- Passwords are hashed with bcrypt before storing
- Payroll settlement uses atomic database claims to make duplicate payouts impossible under concurrency

---

## License

MIT — feel free to fork and build on top of Architect Pay.

---

Built with Circle on Arc mainnet · SCA Wallets · CCTP V2 · Gas Station
