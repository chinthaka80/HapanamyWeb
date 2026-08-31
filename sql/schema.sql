-- HAPANAMY.LK MLM / BINARY PLATFORM
-- PRODUCTION-GRADE POSTGRESQL SCHEMA MIGRATIONS (PHASE 2)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================
-- 1. USERS & CONFIGURATION DOMAINS
-- ========================================================

-- Users Table (Core Auth Entity)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Profiles Table (KYC Details)
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(50) UNIQUE NOT NULL,
    dob DATE NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC Documents Table (Secure Document Registry)
CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nic_passport VARCHAR(100) NOT NULL,
    document_url VARCHAR(512) NOT NULL, -- Private storage file path
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank Accounts Table (For Payout Transfers)
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings Table (Commission Rates, System Configs)
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================
-- 2. SPONSORS & BINARY NETWORK DOMAINS
-- ========================================================

-- Sponsors Table (Referral Map)
CREATE TABLE sponsors (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_sponsor CHECK (user_id != sponsor_id)
);

-- Binary Tree Positions & Hierarchy Table
CREATE TABLE binary_nodes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    placement_parent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    position VARCHAR(10) CHECK (position IN ('LEFT', 'RIGHT')),
    depth INTEGER NOT NULL DEFAULT 1,
    path TEXT NOT NULL DEFAULT '', -- For optimized hierarchical tree traversal queries (e.g. '1/5/12')
    left_child_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    right_child_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_no_self_placement CHECK (user_id != placement_parent_id),
    CONSTRAINT chk_root_has_no_parent CHECK (
        (placement_parent_id IS NULL AND position IS NULL) OR 
        (placement_parent_id IS NOT NULL AND position IS NOT NULL)
    )
);

-- ========================================================
-- 3. PRODUCTS & SALES TRANSACTION DOMAINS
-- ========================================================

-- Products Table (Soft Delete support)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(15, 2) NOT NULL CHECK (price >= 0.00), -- Represents selling_price
    market_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (market_price >= 0.00),
    pricing_mode VARCHAR(50) NOT NULL DEFAULT 'FIXED' CHECK (pricing_mode IN ('FIXED', 'DISCOUNTED')),
    discount_type VARCHAR(50) NOT NULL DEFAULT 'NONE' CHECK (discount_type IN ('FIXED', 'PERCENTAGE', 'NONE')),
    discount_value DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0.00),
    product_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (product_cost >= 0.00),
    minimum_company_profit DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (minimum_company_profit >= 0.00),
    operating_cost_reserve DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (operating_cost_reserve >= 0.00),
    payment_processing_reserve DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (payment_processing_reserve >= 0.00),
    refund_risk_reserve DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (refund_risk_reserve >= 0.00),
    tax_reserve DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_reserve >= 0.00),
    other_reserve DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (other_reserve >= 0.00),
    commission_safety_buffer DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (commission_safety_buffer >= 0.00),
    binary_volume DECIMAL(15, 2) NOT NULL CHECK (binary_volume >= 0.00),
    direct_commission_percent DECIMAL(5, 2) NOT NULL CHECK (direct_commission_percent BETWEEN 0.00 AND 100.00), -- Represents direct_commission_rate in percentage
    binary_commission_percent DECIMAL(5, 2) NOT NULL CHECK (binary_commission_percent BETWEEN 0.00 AND 100.00), -- Represents binary_commission_rate in percentage
    max_binary_qualified_levels INTEGER NOT NULL DEFAULT 7 CHECK (max_binary_qualified_levels >= 0),
    commission_mode VARCHAR(50) NOT NULL DEFAULT 'MANUAL' CHECK (commission_mode IN ('MANUAL', 'AUTO_SAFE')),
    economics_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (economics_status IN ('DRAFT', 'SAFE', 'WARNING', 'BLOCKED')),
    validation_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALIDATED', 'FAILED')),
    blocked_reason TEXT,
    image_url VARCHAR(512),
    course_url VARCHAR(512),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    deleted_at TIMESTAMPTZ, -- Soft delete support
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Purchases Table (Sales Log)
CREATE TABLE product_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    price_paid DECIMAL(15, 2) NOT NULL CHECK (price_paid >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'CANCELLED')),
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment Deposits Table (Slip Approvals Queue)
CREATE TABLE payment_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID UNIQUE NOT NULL REFERENCES product_purchases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_reference VARCHAR(100) UNIQUE NOT NULL, -- Prevent duplicate references
    slip_url VARCHAR(512) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================
-- 4. BINARY LEDGER & COMMISSION DOMAINS (IMMUTABLE HISTORY)
-- ========================================================

-- Binary Volume Ledger (Track LEFT/RIGHT volume accumulation)
CREATE TABLE binary_volume_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    leg VARCHAR(10) NOT NULL CHECK (leg IN ('LEFT', 'RIGHT')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0.00),
    source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    source_purchase_id UUID NOT NULL REFERENCES product_purchases(id) ON DELETE RESTRICT,
    is_matched BOOLEAN NOT NULL DEFAULT false,
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Binary Matches Table
CREATE TABLE binary_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    matched_amount DECIMAL(15, 2) NOT NULL CHECK (matched_amount > 0.00),
    commission_distributed DECIMAL(15, 2) NOT NULL CHECK (commission_distributed >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission Transactions Table
CREATE TABLE commission_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DIRECT', 'BINARY')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REVERSED')),
    source_purchase_id UUID REFERENCES product_purchases(id) ON DELETE RESTRICT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================
-- 5. WALLETS & PAYMENT DOMAINS (IMMUTABLE TRANSACTION LEDGER)
-- ========================================================

-- Wallets Table (Atomic balance counters)
CREATE TABLE wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    available_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0.00),
    pending_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (pending_balance >= 0.00),
    withdrawn_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (withdrawn_amount >= 0.00),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wallet Transactions Table (Double Entry Log)
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('COMMISSION_EARNED', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_PAID', 'REFUND_REVERSAL', 'ADJUSTMENT')),
    amount DECIMAL(15, 2) NOT NULL, -- Negative for withdrawal request/refund, positive for commission
    reference_id UUID NOT NULL, -- References commission_transactions or withdrawal_requests
    reference_type VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Withdrawal Requests Table
CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0.00),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED')),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refund Requests Table
CREATE TABLE refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID UNIQUE NOT NULL REFERENCES product_purchases(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================
-- 6. SYSTEM UTILITIES, SECURITY & AUDITING
-- ========================================================

-- Notifications Table (Soft Delete support)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs Table (Financial/Action Trails)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Actor
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fraud Alerts Table
CREATE TABLE fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- E.g. 'SELF_REFERRAL_SUSPECT', 'VELOCITY_WITHDRAWAL'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================
-- 7. PERFORMANCE & LOOKUP INDEXES
-- ========================================================

CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_binary_nodes_parent_position ON binary_nodes(placement_parent_id, position);
CREATE INDEX idx_binary_nodes_path ON binary_nodes(path);
CREATE INDEX idx_binary_volume_ledger_match ON binary_volume_ledger(user_id, leg, is_matched);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_fraud_alerts_user ON fraud_alerts(user_id);

-- ========================================================
-- 8. SEED DATABASE ENTRIES
-- ========================================================

-- 8.1 Admin User Seeding (Password: Araliya321# hashed)
INSERT INTO users (id, email, password_hash, role, status) VALUES 
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'admin@hapanamy.lk', '$2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgpVM9ku71yqS8vW1g8Yt4a7X9.', 'admin', 'ACTIVE');

INSERT INTO user_profiles (user_id, username, full_name, mobile, dob, address) VALUES 
('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'admin', 'Administrator Hapanamy', '+94726090050', '1990-01-01', 'Hapanamy Campus Headquarters, Colombo, Sri Lanka');

-- 8.2 Products Seeding
INSERT INTO products (id, name, code, description, category, price, binary_volume, direct_commission_percent, binary_commission_percent, status) VALUES
(uuid_generate_v4(), 'Facebook Monetisation Course', 'FB-MON', 'Learn to monetize Facebook Pages smartly.', 'Social Media', 7450.00, 7450.00, 8.00, 7.00, 'ACTIVE'),
(uuid_generate_v4(), 'AI Video Generation Masterclass', 'AI-VID', 'Professional AI Video Creator master training.', 'AI Technology', 5200.00, 5200.00, 8.00, 7.00, 'ACTIVE');

-- 8.3 Commission & Limit Settings Seeding
INSERT INTO settings (key, value, description) VALUES
('direct_commission_percent', '8.00', 'Direct referral commission rate percentage'),
('binary_commission_percent', '7.00', 'Binary volume match commission rate percentage'),
('max_qualified_uplines', '7', 'Maximum number of levels uplines checked for binary payout'),
('daily_earning_limit', '30000.00', 'Maximum LKR payout limit per member per day'),
('daily_earning_cap_scope', 'BINARY', 'Defines limit application (DIRECT, BINARY, or BOTH)');
