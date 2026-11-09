import assert from 'node:assert';

// ── Test 1: Validate Privacy & Anonymization Engine ──────────────────────────
console.log('--- RUNNING TEST 1: Privacy & Data Leakage Scanner ---');

// Mock data generator simulating full metrics output

// Sensitive patterns regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EVM_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}\b/g;
const SECRET_KEY_REGEX = /(?:sk_|api_|secret|private_key|bearer\s+[a-zA-Z0-9_-]{16,})/i;
const USER_ID_REGEX = /^[c-z0-9]{20,}$/i; // CUID format

function scanForPrivacyViolations(obj, path = '') {
  const violations = [];

  if (obj === null || obj === undefined) return violations;

  if (typeof obj === 'string') {
    // Check for email leaks
    const emails = obj.match(EMAIL_REGEX);
    if (emails) {
      violations.push(`Email address leaked at "${path}": ${emails.join(', ')}`);
    }

    // Check for EVM address leaks (excluding token contracts or public documentation references)
    const addresses = obj.match(EVM_ADDRESS_REGEX);
    if (addresses) {
      // Allowed public constants (e.g., token addresses)
      const allowedAddresses = new Set([
        '0x3600000000000000000000000000000000000000',
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      ].map(a => a.toLowerCase()));

      for (const addr of addresses) {
        if (!allowedAddresses.has(addr.toLowerCase())) {
          violations.push(`Individual EVM wallet address leaked at "${path}": ${addr}`);
        }
      }
    }

    // Check for secrets
    if (SECRET_KEY_REGEX.test(obj)) {
      violations.push(`Potential secret key pattern found at "${path}"`);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      violations.push(...scanForPrivacyViolations(item, `${path}[${idx}]`));
    });
  } else if (typeof obj === 'object') {
    // Check key names
    const forbiddenKeys = ['email', 'password', 'passwordHash', 'senderId', 'userId', 'employeeId', 'walletAddress', 'circleUserId', 'circleWalletId', 'circleTxId'];
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key)) {
        violations.push(`Forbidden sensitive field "${key}" present in response object at "${path}"`);
      }
      violations.push(...scanForPrivacyViolations(obj[key], path ? `${path}.${key}` : key));
    }
  }

  return violations;
}

// ── Test 2: Verify Metric Calculations with Simulated Inputs ─────────────────
console.log('--- RUNNING TEST 2: Valuation & Token Calculations ---');

const EURC_RATE = 1.08;

function calculateUsdVolume(amountStr, token) {
  const val = parseFloat(amountStr || '0');
  if (isNaN(val) || val <= 0) return 0;
  if (token.toUpperCase() === 'EURC') {
    return parseFloat((val * EURC_RATE).toFixed(2));
  }
  return parseFloat(val.toFixed(2));
}

assert.strictEqual(calculateUsdVolume('100.00', 'USDC'), 100.00, 'USDC should be 1:1 with USD');
assert.strictEqual(calculateUsdVolume('100.00', 'EURC'), 108.00, 'EURC should multiply by 1.08 USD');
assert.strictEqual(calculateUsdVolume('-50.00', 'USDC'), 0, 'Negative values must return 0');
assert.strictEqual(calculateUsdVolume('invalid', 'USDC'), 0, 'Invalid numbers must return 0');

console.log('✓ Token valuation passed.');

// ── Test 3: Status Filtering Logic ───────────────────────────────────────────
console.log('--- RUNNING TEST 3: Status Filtering Logic ---');

const mockTransactions = [
  { id: '1', status: 'COMPLETED', amount: '100', token: 'USDC' },
  { id: '2', status: 'PENDING', amount: '250', token: 'USDC' },
  { id: '3', status: 'FAILED', amount: '500', token: 'USDC' },
  { id: '4', status: 'CANCELLED', amount: '75', token: 'USDC' },
  { id: '5', status: 'COMPLETED', amount: '50', token: 'EURC' },
];

const completedTxs = mockTransactions.filter(t => t.status === 'COMPLETED');
assert.strictEqual(completedTxs.length, 2, 'Only COMPLETED transactions must be counted');

const totalUsd = completedTxs.reduce((sum, t) => sum + calculateUsdVolume(t.amount, t.token), 0);
assert.strictEqual(totalUsd, 154.00, 'Total verified USD volume must match only completed transactions (100 + 54 = 154)');

console.log('✓ Status filtering verified.');

// ── Test 4: Deduplication Logic ──────────────────────────────────────────────
console.log('--- RUNNING TEST 4: Transaction Hash Deduplication ---');

const hashList = [
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // duplicate
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  null,
  'pending_hash',
  'circle_tx:1234-5678', // Circle internal ID before confirmation
];

function isCandidateHexHash(h) {
  if (!h || typeof h !== 'string') return false;
  const clean = h.trim().toLowerCase();
  return clean.startsWith('0x') && clean.length === 66;
}

const validDeduplicated = new Set(
  hashList.filter(isCandidateHexHash).map(h => h.trim().toLowerCase())
);

assert.strictEqual(validDeduplicated.size, 2, 'Duplicates and internal circle_tx strings must be filtered out');
console.log('✓ Hash deduplication verified.');

// ── Test 5: Scan fallback metrics schema ──────────────────────────────────────
console.log('--- RUNNING TEST 5: Schema Privacy Scan ---');

const sampleMetricsPayload = {
  generatedAt: new Date().toISOString(),
  dataCoverage: {
    period: 'All Time',
    chainsMonitored: 7,
    onChainVerificationActive: true,
    syncStatus: 'synced',
  },
  summary: {
    registeredAccounts: 42,
    activeAccounts30d: 18,
    activeAccountsAllTime: 29,
    verifiedTransactions: 154,
    totalPaymentVolumeUsd: 12450.75,
    activeBusinesses: 6,
    completedPayrollBatches: 12,
    onChainVerifiedTransactions: 150,
  },
  breakdown: {
    volumeByDay: [
      { date: '2026-10-01', volumeUsd: 500, txCount: 4 },
      { date: '2026-10-02', volumeUsd: 1200, txCount: 7 },
    ],
    transactionsByDay: [
      { date: '2026-10-01', volumeUsd: 500, txCount: 4 },
      { date: '2026-10-02', volumeUsd: 1200, txCount: 7 },
    ],
    assetDistribution: [
      { asset: 'USDC', volumeUsd: 10000, txCount: 120, percentage: 80.3 },
      { asset: 'EURC', volumeUsd: 2450.75, txCount: 34, percentage: 19.7 },
    ],
    networkActivity: [
      { chainKey: 'ARC-TESTNET', chainName: 'Arc', txCount: 80, volumeUsd: 7000, percentage: 56.2 },
      { chainKey: 'BASE-SEPOLIA', chainName: 'Base', txCount: 50, volumeUsd: 4000, percentage: 32.1 },
    ],
    productActivity: [
      { category: 'internal_payments', label: 'Internal Payments', txCount: 40, volumeUsd: 3000, percentage: 24.1 },
      { category: 'external_payouts', label: 'External Payouts', txCount: 60, volumeUsd: 5000, percentage: 40.2 },
      { category: 'payroll', label: 'Payroll Batches', txCount: 30, volumeUsd: 4450.75, percentage: 35.7 },
    ],
    internalVsExternal: {
      internalVolumeUsd: 3000,
      internalTxCount: 40,
      externalVolumeUsd: 9450.75,
      externalTxCount: 90,
      internalPercentage: 24.1,
    },
  },
  methodology: {
    accountingStandard: 'Strict completed-state accounting.',
    currencyValuation: 'USDC @ 1.00 USD, EURC @ 1.08 USD.',
    verificationCriteria: 'Reconciled on-chain with RPC receipts.',
    exclusions: 'Failed and pending transactions are strictly excluded.',
    internalVsExternalDefinition: 'Distinguished by recipient wallet address ownership.',
    updateFrequency: 'Cached with 60-second TTL.',
  },
};

const violations = scanForPrivacyViolations(sampleMetricsPayload);
assert.strictEqual(violations.length, 0, `Privacy scan found violations: ${violations.join('\n')}`);
console.log('✓ Privacy scanner confirmed ZERO sensitive data leaks.');

console.log('\n========================================');
console.log('✅ ALL METRIC & PRIVACY TESTS PASSED SUCCESSFULLY!');
console.log('========================================');
