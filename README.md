# ⬡ Architect Pay

> **Gasless multi-chain USDC payroll built on Arc Testnet.**
> Pay employees across chains instantly — zero gas, on-chain records, one click.

![Network](https://img.shields.io/badge/Network-Arc%20Testnet-00e5a0?style=for-the-badge)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Circle](https://img.shields.io/badge/Circle-SCA%20Wallets-0099ff?style=for-the-badge)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)

---

## What is Architect Pay?

Architect Pay is a USDC payroll platform that lets businesses pay employees across multiple chains from a single dashboard — no manual bridging, no gas fees, no complexity.

Add your employees, set their salaries, hit **Run Payroll** — Architect Pay automatically pulls USDC from whichever chains you have balance on, bridges it to Arc via CCTP V2, and pays everyone in parallel. Every run is permanently recorded on-chain.

Built for the **Circle × Arc Stablecoins Commerce Stack Challenge**.

---

## Live Demo

🌐 **[architect.pay.98pro.xyz](https://architect.pay.98pro.xyz)**

---

## Features

- **Gasless Deposits** — Zero gas fees for users, sponsored by Circle Gas Station
- **One-Click Payroll** — Pay all active employees in parallel with a single button
- **Cross-Chain Funding** — Automatically pulls USDC from ETH, Polygon, Avalanche, and more into Arc via CCTP V2
- **Aggregate Send** — Send to any address by sweeping balance across all chains at once
- **On-Chain Payroll Records** — Every payment and payroll run emits events on the ArchitectPay smart contract
- **Employee Management** — Add employees with wallet addresses and USDC salaries
- **Transaction History** — Full payment history with on-chain tx hashes and ArcScan links
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
│                  ARC TESTNET — CIRCLE L1                    │
│       Chain ID: 5042002 · Sub-second finality               │
│            Dollar-denominated fees · USDC native            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            ARCHITECTPAY SMART CONTRACT                      │
│       0xfb7c98226faa83f3fec2ef6e32ee8860f991ac4d           │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  recordPayment()     │  │  recordPayrollRun()      │    │
│  │  Emits PaymentSent   │  │  Emits PayrollRun        │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└──────────┬──────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │                     │                       │
    ▼                     ▼                       ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Circle SCA   │  │  Circle CCTP V2  │  │  Neon PostgreSQL │
│  Wallets      │  │  Cross-chain     │  │  Users, wallets  │
│  ERC-4337     │  │  USDC bridging   │  │  employees, runs │
│  Gas Station  │  │  ETH/Polygon/Avax│  │  Prisma ORM      │
└───────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Circle Products Used

| Product | Usage |
|---------|-------|
| **Developer-Controlled SCA Wallets** | Every user gets a smart contract wallet — gasless, no seed phrase |
| **Gas Station** | Sponsors all transaction fees so users never need native tokens |
| **CCTP V2** | Pulls USDC from Ethereum, Polygon, Avalanche into Arc automatically |
| **Smart Contract Platform** | Deployed the custom ArchitectPay contract on Arc Testnet |
| **USDC on Arc** | Primary settlement token for all payroll and payments |

---

## Payroll Flow

```
User clicks "Run Payroll"
        │
        ▼
1. Fetch balances across all chains (Arc + CCTP chains)
        │
        ▼
2. Compute funding plan — which chains to pull from
        │
        ├── If CCTP chains needed:
        │   └── Pull USDC → user's Arc wallet via CCTP V2
        │
        ▼
3. Pay all employees in parallel from Arc wallet
        │
        ▼
4. Record results in database
        │
        ▼
5. Emit PayrollRun event on ArchitectPay contract (fire-and-forget)
```

---

## Smart Contract

**Deployed on Arc Testnet:**
```
0xfb7c98226faa83f3fec2ef6e32ee8860f991ac4d
```

**View on Explorer:**
[testnet.arcscan.app](https://testnet.arcscan.app/address/0xfb7c98226faa83f3fec2ef6e32ee8860f991ac4d)

### Contract Functions

| Function | Description |
|----------|-------------|
| `recordPayment(address, uint256, string)` | Emits `PaymentSent` event for every USDC transfer |
| `recordPayrollRun(uint256, uint256)` | Emits `PayrollRun` event with total amount and employee count |

### Contract Events

| Event | Parameters |
|-------|------------|
| `PaymentSent` | sender, recipient, amount (micro USDC), label |
| `PayrollRun` | sender, totalAmount, employeeCount, timestamp |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router + React |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Wallets | Circle Developer-Controlled SCA Wallets (ERC-4337) |
| Cross-chain | Circle CCTP V2 |
| Gas | Circle Gas Station |
| Smart Contract | Solidity 0.8.20 |
| Contract Deploy | Circle Smart Contract Platform SDK |
| Database | Neon PostgreSQL + Prisma ORM |
| Auth | JWT (jose) + bcryptjs |
| Hosting | Vercel |
| Network | Arc Testnet (Circle L1) |

---

## Arc Testnet Details

| Property | Value |
|----------|-------|
| Network Name | Arc Testnet |
| Chain ID | `5042002` (0x4cef52) |
| RPC URL | `https://rpc.testnet.arc.io` |
| Block Explorer | `https://testnet.arcscan.app` |
| Gas Token | USDC |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |

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

---

## Project Structure

```
architect-pay/
├── app/
│   ├── (auth)/              ← Login and signup pages
│   ├── (dashboard)/         ← Dashboard, payments, payroll, employees, history
│   ├── api/                 ← API routes (payments, payroll, wallets, auth)
│   └── page.tsx             ← Landing page
├── components/              ← Nav, deposit modal
├── contracts/
│   └── ArchitectPay.sol     ← On-chain event registry
├── lib/
│   ├── circle.ts            ← Circle SDK wrapper
│   ├── cctp.ts              ← CCTP V2 cross-chain transfers
│   ├── architect-pay-contract.ts ← On-chain logging
│   └── db.ts                ← Prisma client
├── prisma/
│   └── schema.prisma        ← Database schema
└── scripts/
    └── deploy-custom-contract.mjs ← Contract deployment script
```

---

## Security Notes

- ⚠️ This is a **testnet** deployment — do not use real funds
- Entity secrets and API keys are stored server-side only, never exposed to the browser
- Passwords are hashed with bcrypt before storing

---

## License

MIT — feel free to fork and build on top of Architect Pay.

---

Built with ⬡ on Arc Testnet · Circle SCA Wallets · CCTP V2 · Gas Station
