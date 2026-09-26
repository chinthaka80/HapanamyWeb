// ==============================================================================
// NEXUS PRIME (PVT) LTD — ISOLATED CONFIGURATION MODULE
// DOMAIN: nexusp.online
// ==============================================================================

const path = require('path');

const NexusConfig = {
    // Application Identity
    COMPANY_NAME: process.env.NEXUS_COMPANY_NAME || 'Nexus Prime (PVT) Ltd',
    DOMAIN: process.env.NEXUS_DOMAIN || 'nexusp.online',
    APPLICATION_URL: process.env.NEXUS_APP_URL || 'https://nexusp.online',
    PORT: parseInt(process.env.NEXUS_PORT, 10) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Database Connection (PostgreSQL 15+ / Supabase - STRICTLY ISOLATED)
    DATABASE_URL: process.env.NEXUS_DATABASE_URL || null,

    // Security Secrets
    SESSION_SECRET: process.env.NEXUS_SESSION_SECRET || 'nexus_prime_sec_session_token_key_9921827491',
    AUTH_SECRET: process.env.NEXUS_AUTH_SECRET || 'nexus_prime_auth_secret_key_8849201948271',
    JWT_SECRET: process.env.NEXUS_JWT_SECRET || 'nexus_prime_jwt_secret_token_key_55102948172',

    // MLM Business Defaults
    DEFAULT_ROOT_MEMBER_ID: 'NP000001',
    DEFAULT_ROOT_REFERRAL_CODE: 'NEXUS001',
    MEMBER_ID_PREFIX: 'NP',
    REFERRAL_CODE_PREFIX: 'NEXUS',
    ALLOW_ORPHAN_REGISTRATION: process.env.NEXUS_ALLOW_ORPHAN !== 'false', // Default: true (attaches to root)
    MAX_NETWORK_LEVELS: 100,
    DIRECT_COMMISSION_PERCENT: 8.00,
    BINARY_COMMISSION_PERCENT: 7.00,
    DAILY_EARNINGS_CAP_LKR: 30000.00,
    MIN_WITHDRAWAL_AMOUNT_LKR: 1000.00,
    MAX_WITHDRAWAL_AMOUNT_LKR: 500000.00,
    WITHDRAWAL_FEE_TYPE: 'none', // 'none' | 'fixed' | 'percentage'
    WITHDRAWAL_FEE_VALUE: 0.00,
    WITHDRAWAL_ENABLED: true,
    WITHDRAWAL_PREFIX: 'NP-WD-',

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: 60 * 1000,
    RATE_LIMIT_MAX_REQUESTS: 150,

    // Payment Gateway & Provider Configuration
    PAYMENT_PROVIDER: process.env.NEXUS_PAYMENT_PROVIDER || 'sandbox', // 'none' | 'sandbox' | 'payhere'
    PAYMENT_MERCHANT_ID: process.env.NEXUS_PAYMENT_MERCHANT_ID || 'SANDBOX_MERCHANT_001',
    PAYMENT_API_KEY: process.env.NEXUS_PAYMENT_API_KEY || null,
    PAYMENT_API_SECRET: process.env.NEXUS_PAYMENT_API_SECRET || 'nexus_sandbox_secret_key_77382910',
    PAYMENT_WEBHOOK_SECRET: process.env.NEXUS_PAYMENT_WEBHOOK_SECRET || 'nexus_webhook_sec_88491029',
    PAYMENT_SANDBOX_MODE: process.env.NEXUS_PAYMENT_SANDBOX !== 'false'
};

module.exports = NexusConfig;
