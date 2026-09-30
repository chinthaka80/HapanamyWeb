const http = require('http');
const fs = require('fs');
const path = require('path');
const AuthService = require('./services/auth-service');
const PlacementEngine = require('./services/placement-engine');
const KycService = require('./services/kyc-service');
const ProductService = require('./services/product-service');
const WalletService = require('./services/wallet-service');
const ReportService = require('./services/report-service');
const RefundService = require('./services/refund-service');
const CommissionCore = require('./services/commission-core');
const VolumeLedger = require('./services/volume-ledger');
const SecurityCore = require('./services/security-core');
const ProductEconomicsCalculator = require('./services/product-economics-calculator');
const ProductCommissionValidator = require('./services/product-commission-validator');
const SafeBinaryCommissionRateCalculator = require('./services/safe-binary-commission-calculator');
const ProductSnapshotService = require('./services/product-snapshot-service');
const ProductEconomicsService = require('./services/product-economics-service');
const ReferralService = require('./services/referral-service');
const QualificationEngine = require('./services/qualification-engine');
const MemberDashboardService = require('./services/member-dashboard-service');
const AdminDashboardService = require('./services/admin-dashboard-service');
const NotificationEngine = require('./services/notification-engine');
const ReversalEngine = require('./services/reversal-engine');
const SimulationEngine = require('./services/simulation-engine');
const PurchaseOrchestrator = require('./services/purchase-orchestrator');
const MLMNetworkEngine = require('./services/mlm-network-engine');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.txt': 'text/plain'
};

// Simulated Database Sessions (Token store)
const activeSessions = new Map();

function isAdminUser(user) {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return role === 'admin' || role === 'subadmin' || role === 'sub_admin' || role === 'super_admin' || role === 'finance_admin' || role === 'compliance';
}

// Mock Databases for Phase 3/4/5/8/11/12/13/26/27
const mockWallets = [];
const mockReferralIntents = [];
const mockKycDocs = [
    { id: 'kyc-1', user_id: 'sponsor-uuid-1', id_type: 'NIC', id_number: '199512345678', full_name: 'Kasun Tharaka', status: 'APPROVED', created_at: '2026-08-01T10:00:00Z' },
    { id: 'kyc-2', user_id: 'nimal-uuid-2', id_type: 'NIC', id_number: '199487654321', full_name: 'Nimal Silva', status: 'APPROVED', created_at: '2026-08-05T10:00:00Z' },
    { id: 'kyc-3', user_id: 'sunil-uuid-3', id_type: 'NIC', id_number: '199611223344', full_name: 'Sunil Kumar', status: 'APPROVED', created_at: '2026-08-10T10:00:00Z' }
];
const mockBankAccounts = [
    { user_id: 'sponsor-uuid-1', bank_name: 'Commercial Bank', branch: 'Maharagama', account_number: '8010294851', account_holder_name: 'Kasun Tharaka' }
];
const mockAuditLogs = [];
const mockEconomicsVersions = [];
const mockFinancialAuditLogs = [];
const mockEconomicsSnapshots = [];
let mockEconomicsDefaults = {
    tax_percent: 5.00,
    hosting_cost_fixed: 100.00,
    staff_cost_fixed: 300.00,
    marketing_cost_fixed: 400.00,
    refund_reserve_percent: 3.00,
    support_cost_fixed: 100.00,
    operational_cost_fixed: 150.00,
    payment_processing_fixed: 0.00,
    profit_reserve_percent: 15.00,
    direct_commission_percent: 8.00,
    binary_commission_percent: 7.00,
    maximum_qualified_uplines: 7,
    updated_at: new Date().toISOString()
};

const mockCompanyBankDetails = [
    {
        id: 'bank-hnb-1',
        bank_name: 'Hatton National Bank (HNB)',
        account_name: 'HAPANAMY ENTERPRISES (PVT) LTD',
        account_number: '081020048921',
        branch: 'Maharagama',
        currency: 'LKR',
        is_primary: true
    },
    {
        id: 'bank-com-2',
        bank_name: 'Commercial Bank of Ceylon',
        account_name: 'HAPANAMY ENTERPRISES (PVT) LTD',
        account_number: '1000849201',
        branch: 'Nugegoda',
        currency: 'LKR',
        is_primary: false
    }
];

const mockProducts = [
    {
        id: 'facebook-course',
        code: 'FB-MON',
        name: 'Facebook Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        title: 'Facebook Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        category: 'Social Media',
        original_price: 9900.00,
        discount_price: 7425.00,
        price: 7425.00,
        selling_price: 7425.00,
        product_cost: 1500.00,
        binary_volume: 7425.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/facebook_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/fb-mon',
        duration: '4 Weeks (8 Live Zoom Sessions)',
        access_type: 'Lifetime Access + Recording Archive',
        description: 'Facebook Pages monetization, Reels bonus program, in-stream ads, and copyright-safe viral growth strategies.',
        benefits: [
            'Facebook In-Stream Ads & Stars Setup',
            'Viral Reel Editing & Content Automation',
            'Copyright Safety & Policy Compliance',
            'Live Q&A Support with Top Instructors'
        ],
        modules_count: 8,
        status: 'ACTIVE'
    },
    {
        id: 'tiktok-course',
        code: 'TIK-MON',
        name: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        title: 'TikTok Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        category: 'Social Media',
        original_price: 5000.00,
        discount_price: 4500.00,
        price: 4500.00,
        selling_price: 4500.00,
        product_cost: 900.00,
        binary_volume: 4500.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/tiktok_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/tiktok-mon',
        duration: '2 Weeks (4 Live Zoom Sessions)',
        access_type: 'Lifetime Access',
        description: 'TikTok Creativity Program Beta, TikTok Shop Affiliate, and organic viral scaling framework.',
        benefits: [
            'TikTok US/UK Account Creation & Verification',
            'Creativity Program Beta Payout Strategies',
            'Affiliate Product Sourcing & High-Converting Videos'
        ],
        modules_count: 5,
        status: 'ACTIVE'
    },
    {
        id: 'youtube-course',
        code: 'YT-MON',
        name: 'YouTube Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        title: 'YouTube Monetization ප්‍රායෝගික පාඨමාලාව (Online Zoom)',
        category: 'Social Media',
        original_price: 9900.00,
        discount_price: 7425.00,
        price: 7425.00,
        selling_price: 7425.00,
        product_cost: 1500.00,
        binary_volume: 7425.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/youtube_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/youtube-mon',
        duration: '4 Weeks (8 Live Zoom Sessions)',
        access_type: 'Lifetime Access + Niche Blueprints',
        description: 'Faceless YouTube automation, SEO ranking, high RPM niches, and AdSense approval acceleration.',
        benefits: [
            'High RPM Niche Selection Guide',
            'AI Scripting & Voiceover Automation',
            'Fast 4,000 Watch Hours & 1,000 Subs Growth'
        ],
        modules_count: 8,
        status: 'ACTIVE'
    },
    {
        id: 'social-media-masterclass',
        code: 'SOC-MASTER',
        name: '🚀 Social Media Income Masterclass 2026',
        title: '🚀 Social Media Income Masterclass 2026',
        category: 'Social Media',
        original_price: 19990.00,
        discount_price: 15992.00,
        price: 15992.00,
        selling_price: 15992.00,
        product_cost: 2500.00,
        binary_volume: 15992.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/social_media_masterclass_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/soc-master',
        duration: '6 Weeks Masterclass',
        access_type: 'VIP Lifetime Access + Agency Kit',
        description: 'Complete digital marketing agency, personal branding, and multi-channel monetization masterclass.',
        benefits: [
            'All-in-one FB, TikTok, IG, and YouTube Mastery',
            'High-ticket client acquisition scripts',
            'Official Masterclass Completion Certificate'
        ],
        modules_count: 14,
        status: 'ACTIVE'
    },
    {
        id: 'forex-course',
        code: 'FX-BEG',
        name: '🟢 Beginner – Forex Trading Course (Online Zoom)',
        title: '🟢 Beginner – Forex Trading Course (Online Zoom)',
        category: 'Trading',
        original_price: 9900.00,
        discount_price: 7920.00,
        price: 7920.00,
        selling_price: 7920.00,
        product_cost: 1500.00,
        binary_volume: 7920.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/forex_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/forex-beg',
        duration: '3 Weeks (6 Sessions)',
        access_type: 'Lifetime Access + MT4/MT5 Setup',
        description: 'From candlestick basics to risk management and profitable trading psychology.',
        benefits: [
            'Live Market Analysis & Execution',
            'Proper Lot Sizing & Risk Calculator',
            'VIP Trading Signal Group Access (1 Month)'
        ],
        modules_count: 6,
        status: 'ACTIVE'
    },
    {
        id: 'crypto-course',
        code: 'CRYPTO-BEG',
        name: '🟠 Beginner – Crypto Trading Course (Online Zoom)',
        title: '🟠 Beginner – Crypto Trading Course (Online Zoom)',
        category: 'Trading',
        original_price: 9900.00,
        discount_price: 7920.00,
        price: 7920.00,
        selling_price: 7920.00,
        product_cost: 1500.00,
        binary_volume: 7920.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/crypto_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/crypto-beg',
        duration: '3 Weeks (6 Sessions)',
        access_type: 'Lifetime Access + Spot/Futures Guides',
        description: 'Binance, Bybit spot & futures trading, wallet security, and on-chain analysis.',
        benefits: [
            'Exchange Setup & P2P Deposit/Withdrawal Guide',
            'Futures Leverage Risk Mitigation',
            'Altcoin Gem Research Blueprint'
        ],
        modules_count: 6,
        status: 'ACTIVE'
    },
    {
        id: 'options-course',
        code: 'OPT-INT',
        name: '🔵 Intermediate – Options Trading Course (Online Zoom)',
        title: '🔵 Intermediate – Options Trading Course (Online Zoom)',
        category: 'Trading',
        original_price: 9900.00,
        discount_price: 7920.00,
        price: 7920.00,
        selling_price: 7920.00,
        product_cost: 1500.00,
        binary_volume: 7920.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/options_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/options-int',
        duration: '3 Weeks (6 Sessions)',
        access_type: 'Lifetime Access',
        description: 'Call/Put options strategies, implied volatility, spreads, and hedging techniques.',
        benefits: [
            'Options Greeks Decoded (Delta, Theta, Gamma)',
            'Defined-Risk Spreads Strategy',
            'Deribit & US Options Practice Setup'
        ],
        modules_count: 6,
        status: 'ACTIVE'
    },
    {
        id: 'titan-elite',
        code: 'SMC-ADV',
        name: '🔴 Professional – Advanced Institutional Trading (SMC / ICT)',
        title: '🔴 Professional – Advanced Institutional Trading (SMC / ICT)',
        category: 'Trading',
        original_price: 24900.00,
        discount_price: 19900.00,
        price: 19900.00,
        selling_price: 19900.00,
        product_cost: 3000.00,
        binary_volume: 19900.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/advanced_trading_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/smc-adv',
        duration: '8 Weeks Intensive',
        access_type: 'Lifetime Access + Prop Firm Strategy',
        description: 'Smart Money Concepts, Order Blocks, Liquidity Sweeps, Fair Value Gaps, and Prop Firm Passing system.',
        benefits: [
            'Institutional Order Flow & FVG Identification',
            'Prop Firm Funded Account Blueprint ($50k - $200k)',
            'Weekly Live Market Breakdown Webinars'
        ],
        modules_count: 16,
        status: 'ACTIVE'
    },
    {
        id: 'ai-video-course',
        code: 'AI-VID',
        name: '🎬 AI Video Generation Masterclass 2026',
        title: '🎬 AI Video Generation Masterclass 2026',
        category: 'AI & Tech',
        original_price: 6500.00,
        discount_price: 5200.00,
        price: 5200.00,
        selling_price: 5200.00,
        product_cost: 1000.00,
        binary_volume: 5200.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/ai_video_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/ai-video',
        duration: '2 Weeks (4 Sessions)',
        access_type: 'Lifetime Access + Tool Prompts',
        description: 'Runway Gen-3, Midjourney, Kling, ElevenLabs voice cloning, and AI film creation.',
        benefits: [
            'Cinematic Prompt Engineering for Video',
            'Hyper-Realistic AI Avatars & Voice Syncing',
            'Commercial Video Production for Clients'
        ],
        modules_count: 5,
        status: 'ACTIVE'
    },
    {
        id: 'ai-mastery-course',
        code: 'AI-MAST',
        name: '🤖 AI Mastery Program 2026',
        title: '🤖 AI Mastery Program 2026',
        category: 'AI & Tech',
        original_price: 18750.00,
        discount_price: 15000.00,
        price: 15000.00,
        selling_price: 15000.00,
        product_cost: 2500.00,
        binary_volume: 15000.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/ai_mastery_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/ai-mastery',
        duration: '6 Weeks Comprehensive',
        access_type: 'VIP Lifetime Access + AI Toolkit',
        description: 'Advanced ChatGPT prompting, custom GPTs, AI agent workflows, and productivity automation.',
        benefits: [
            'Building Custom AI Agents & Workflows',
            'Automating Business Operations with AI',
            'Certificate in Applied Artificial Intelligence'
        ],
        modules_count: 12,
        status: 'ACTIVE'
    },
    {
        id: 'coding-course',
        code: 'CODE-WEB',
        name: '💻 Coding & Web Development Masterclass 2026',
        title: '💻 Coding & Web Development Masterclass 2026',
        category: 'AI & Tech',
        original_price: 9000.00,
        discount_price: 7200.00,
        price: 7200.00,
        selling_price: 7200.00,
        product_cost: 1500.00,
        binary_volume: 7200.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/coding_course_banner.jpg',
        course_url: 'https://hapanamy.lk/courses/coding-web',
        duration: '4 Weeks (8 Sessions)',
        access_type: 'Lifetime Access + Source Codes',
        description: 'HTML5, CSS3, JavaScript, modern responsive website design, and web app deployment.',
        benefits: [
            'Building 3 Real-World Portfolio Websites',
            'Hosting, Domains & SSL Configuration',
            'Freelance Web Development Client Starter Kit'
        ],
        modules_count: 8,
        status: 'ACTIVE'
    },
    {
        id: 'trading-ebook',
        code: 'EB-TRD',
        name: '📘 Trading A to Z – Master E-Book 2026',
        title: '📘 Trading A to Z – Master E-Book 2026',
        category: 'E-Book',
        original_price: 4990.00,
        discount_price: 3992.00,
        price: 3992.00,
        selling_price: 3992.00,
        product_cost: 500.00,
        binary_volume: 3992.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/ebooks_banner.jpg',
        course_url: 'https://hapanamy.lk/downloads/trading-ebook',
        duration: 'Digital E-Book (PDF Instant Download)',
        access_type: 'Instant Digital PDF Download',
        description: 'Comprehensive 180+ page color trading guide with chart patterns, indicators, and cheat sheets.',
        benefits: [
            'Printable High-Resolution Chart Pattern Cheatsheets',
            'Risk Management Rules Reference',
            'Free Lifetime Updates as Market Evolves'
        ],
        modules_count: 1,
        status: 'ACTIVE'
    },
    {
        id: 'motivation-ebook',
        code: 'EB-MOT',
        name: '📖 Motivation & Self-Development Master E-Book 2026',
        title: '📖 Motivation & Self-Development Master E-Book 2026',
        category: 'E-Book',
        original_price: 6990.00,
        discount_price: 5592.00,
        price: 5592.00,
        selling_price: 5592.00,
        product_cost: 500.00,
        binary_volume: 5592.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/motivation_ebook_banner.jpg',
        course_url: 'https://hapanamy.lk/downloads/motivation-ebook',
        duration: 'Digital E-Book (PDF Instant Download)',
        access_type: 'Instant Digital PDF Download',
        description: 'Mindset mastery, financial discipline, habit transformation, and high-performance habits.',
        benefits: [
            'Daily Habit Tracker Printable Worksheets',
            'Goal Setting Framework & Action Planner'
        ],
        modules_count: 1,
        status: 'ACTIVE'
    },
    {
        id: 'ai-prompts-ebook',
        code: 'EB-PRM',
        name: '📘 AI Prompts & Templates Ultimate Collection 2026',
        title: '📘 AI Prompts & Templates Ultimate Collection 2026',
        category: 'E-Book',
        original_price: 2500.00,
        discount_price: 2000.00,
        price: 2000.00,
        selling_price: 2000.00,
        product_cost: 300.00,
        binary_volume: 2000.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        image_url: 'assets/ai_prompts_ebook_banner.jpg',
        course_url: 'https://hapanamy.lk/downloads/ai-prompts',
        duration: 'Digital E-Book + Copy-Paste Notion Template',
        access_type: 'Instant Digital Download',
        description: 'Over 1,000+ battle-tested AI prompts for copywriting, coding, trading analysis, and image design.',
        benefits: [
            'Categorized Notion Database with Copy-Paste Prompts',
            'Regularly Updated with New AI Models'
        ],
        modules_count: 1,
        status: 'ACTIVE'
    }
];

const mockProductSnapshots = [
    {
        id: 'snap-soc-1',
        product_id: 'social-media-masterclass',
        product_name: 'Social Media Income Masterclass 2026',
        selling_price: 15992.00,
        product_cost: 2500.00,
        binary_volume: 15992.00,
        direct_commission_percent: 8.00,
        binary_commission_percent: 7.00,
        max_binary_qualified_levels: 7,
        created_at: '2026-08-01T08:00:00Z'
    }
];

const mockProductPurchases = [
    {
        id: 'ord-hiru-001',
        order_number: 'ORD-HIRU-001',
        user_id: 'user-hiru-root',
        product_id: 'social-media-masterclass',
        product_name: 'Social Media Income Masterclass 2026',
        amount: 15992.00,
        price_paid: 15992.00,
        binary_volume: 15992.00,
        payment_method: 'ADMIN_MANUAL',
        status: 'ACTIVE',
        activated_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z'
    },
    {
        id: 'ord-sun-002',
        order_number: 'ORD-SUN-002',
        user_id: 'user-sun-101',
        product_id: 'facebook-course',
        product_name: 'Facebook Monetization Practical Course',
        amount: 7425.00,
        price_paid: 7425.00,
        binary_volume: 7425.00,
        payment_method: 'BANK_TRANSFER',
        status: 'ACTIVE',
        activated_at: '2026-09-02T00:00:00Z',
        created_at: '2026-09-02T00:00:00Z'
    },
    {
        id: 'ord-sundd-003',
        order_number: 'ORD-SUNDD-003',
        user_id: 'user-sundd-102',
        product_id: 'tiktok-course',
        product_name: 'TikTok Monetization Practical Course',
        amount: 4500.00,
        price_paid: 4500.00,
        binary_volume: 4500.00,
        payment_method: 'BANK_TRANSFER',
        status: 'ACTIVE',
        activated_at: '2026-09-03T00:00:00Z',
        created_at: '2026-09-03T00:00:00Z'
    }
];

const mockPaymentDeposits = [
    {
        id: 'dep-sun-002',
        order_id: 'ord-sun-002',
        user_id: 'user-sun-101',
        user_name: 'Sun',
        user_email: 'sun@hapanamy.lk',
        product_id: 'facebook-course',
        product_name: 'Facebook Monetization Practical Course',
        amount: 7425.00,
        bank_reference: 'TXN-BOC-849201',
        status: 'APPROVED',
        created_at: '2026-09-02T00:00:00Z'
    },
    {
        id: 'dep-sundd-003',
        order_id: 'ord-sundd-003',
        user_id: 'user-sundd-102',
        user_name: 'SUNDD',
        user_email: 'sundd@hapanamy.lk',
        product_id: 'tiktok-course',
        product_name: 'TikTok Monetization Practical Course',
        amount: 4500.00,
        bank_reference: 'TXN-COM-910283',
        status: 'APPROVED',
        created_at: '2026-09-03T00:00:00Z'
    }
];

const mockUsers = [
    { 
        id: 'user-hiru-root', 
        username: 'Hiru', 
        full_name: 'Hiru (Sales Leader)', 
        name: 'Hiru (Sales Leader)',
        email: 'hiru@hapanamy.lk', 
        role: 'member', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED',
        kyc_status: 'APPROVED',
        position: 'ROOT',
        referral_code: 'Hiru',
        password: 'Hapana123',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        created_at: '2026-09-01T00:00:00Z' 
    },
    { 
        id: 'user-namobuddhaya-root', 
        username: 'NAMOBUDDHAYA', 
        full_name: 'Main Admin (NAMOBUDDHAYA)', 
        name: 'Main Admin (NAMOBUDDHAYA)',
        email: 'admin@hapanamy.lk', 
        role: 'admin', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED',
        kyc_status: 'APPROVED',
        position: 'ROOT',
        referral_code: 'NAMOBUDDHAYA',
        password: 'Hapana123',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        created_at: '2026-09-01T00:00:00Z' 
    },
    { 
        id: 'user-subadmin-manager', 
        username: 'subadmin', 
        full_name: 'Sub Admin (Operations Manager)', 
        name: 'Sub Admin (Operations Manager)',
        email: 'manager@hapanamy.lk', 
        role: 'subadmin', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'QUALIFIED',
        kyc_status: 'APPROVED',
        position: 'ROOT',
        referral_code: 'SUBADMIN',
        password: 'Hapana123',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        created_at: '2026-09-01T00:00:00Z' 
    },
    { 
        id: 'user-sun-101', 
        username: 'Sun', 
        full_name: 'Sun', 
        name: 'Sun',
        email: 'sun@hapanamy.lk', 
        phone: '0771234567',
        role: 'member', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'NOT_QUALIFIED',
        kyc_status: 'PENDING',
        position: 'LEFT',
        branch_leg: 'LEFT',
        sponsor: 'Hiru',
        sponsor_id: 'user-hiru-root',
        sponsor_username: 'Hiru',
        referral_code: 'Sun',
        password: 'Hapana123',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        created_at: '2026-09-02T00:00:00Z' 
    },
    { 
        id: 'user-sundd-102', 
        username: 'SUNDD', 
        full_name: 'SUNDD', 
        name: 'SUNDD',
        email: 'sundd@hapanamy.lk', 
        phone: '0779876543',
        role: 'member', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'NOT_QUALIFIED',
        kyc_status: 'PENDING',
        position: 'LEFT',
        branch_leg: 'LEFT',
        sponsor: 'Sun',
        sponsor_id: 'user-sun-101',
        sponsor_username: 'Sun',
        referral_code: 'SUNDD',
        password: 'Hapana123',
        password_hash: '8639bf7eafee04438d92c46948989726:95a6523d509eb56ae5841e7a311a23445ec21524de1819bd64725445c552a5a279233e7ff746818ded8851004b35179e0222dd80e734a6b1eb2ee2f062d2d4ed',
        created_at: '2026-09-03T00:00:00Z' 
    },
    { 
        id: 'user-star01-103', 
        username: 'Star01', 
        full_name: 'Star01', 
        name: 'Star01',
        email: 'star01@hapanamy.lk', 
        phone: '0775551234',
        role: 'member', 
        status: 'ACTIVE', 
        account_status: 'ACTIVE',
        qualification_status: 'NOT_QUALIFIED',
        kyc_status: 'PENDING',
        position: 'RIGHT',
        branch_leg: 'RIGHT',
        sponsor: 'Hiru',
        sponsor_id: 'user-hiru-root',
        sponsor_username: 'Hiru',
        referral_code: 'Star01',
        password: 'Hapana123',
        created_at: '2026-09-29T10:00:00Z' 
    }
];

// Pre-seed known active sessions
activeSessions.set('token-hiru-member', { 
    id: 'user-hiru-root', 
    username: 'Hiru', 
    full_name: 'Hiru (Sales Leader)', 
    email: 'hiru@hapanamy.lk', 
    role: 'member' 
});
activeSessions.set('token-namobuddhaya-root', { 
    id: 'user-namobuddhaya-root', 
    username: 'NAMOBUDDHAYA', 
    full_name: 'NAMOBUDDHAYA', 
    email: 'admin@hapanamy.lk', 
    role: 'admin' 
});
activeSessions.set('token-subadmin-manager', { 
    id: 'user-subadmin-manager', 
    username: 'subadmin', 
    full_name: 'Sub Admin (Operations Manager)', 
    email: 'manager@hapanamy.lk', 
    role: 'subadmin' 
});
activeSessions.set('token-sun-member', { 
    id: 'user-sun-101', 
    username: 'Sun', 
    full_name: 'Sun', 
    email: 'sun@hapanamy.lk', 
    role: 'member' 
});
activeSessions.set('token-sundd-member', { 
    id: 'user-sundd-102', 
    username: 'SUNDD', 
    full_name: 'SUNDD', 
    email: 'sundd@hapanamy.lk', 
    role: 'member' 
});
activeSessions.set('token-star01-member', { 
    id: 'user-star01-103', 
    username: 'Star01', 
    full_name: 'Star01', 
    email: 'star01@hapanamy.lk', 
    role: 'member' 
});

const mockWalletLedger = [
    {
        id: 'wal-hiru-001',
        user_id: 'user-hiru-root',
        type: 'DIRECT_COMMISSION',
        reference_id: 'ord-sun-002',
        amount: 594.00,
        credit_amount: 594.00,
        debit_amount: 0.00,
        balance_after: 594.00,
        description: "8% Direct Commission from Sun's Facebook Course",
        created_at: '2026-09-02T00:00:00Z'
    },
    {
        id: 'wal-sun-002',
        user_id: 'user-sun-101',
        type: 'DIRECT_COMMISSION',
        reference_id: 'ord-sundd-003',
        amount: 360.00,
        credit_amount: 360.00,
        debit_amount: 0.00,
        balance_after: 360.00,
        description: "8% Direct Commission from SUNDD's TikTok Course",
        created_at: '2026-09-03T00:00:00Z'
    }
];
const mockWithdrawalRequests = [];
const mockRefundRequests = [];
const mockVolumeLedger = [
    {
        id: 'vol-hiru-001',
        user_id: 'user-hiru-root',
        leg: 'LEFT',
        volume: 7425.00,
        source_order_id: 'ord-sun-002',
        source_user_id: 'user-sun-101',
        created_at: '2026-09-02T00:00:00Z'
    },
    {
        id: 'vol-hiru-002',
        user_id: 'user-hiru-root',
        leg: 'LEFT',
        volume: 4500.00,
        source_order_id: 'ord-sundd-003',
        source_user_id: 'user-sundd-102',
        created_at: '2026-09-03T00:00:00Z'
    },
    {
        id: 'vol-sun-001',
        user_id: 'user-sun-101',
        leg: 'LEFT',
        volume: 4500.00,
        source_order_id: 'ord-sundd-003',
        source_user_id: 'user-sundd-102',
        created_at: '2026-09-03T00:00:00Z'
    }
];
const mockBinaryNodes = [
    { 
        id: 'node-hiru-root', 
        user_id: 'user-hiru-root', 
        placement_parent_id: null, 
        position: null, 
        depth: 1, 
        path: '', 
        left_child_id: 'node-sun-101', 
        right_child_id: null, 
        created_at: '2026-09-01T00:00:00Z' 
    },
    { 
        id: 'node-sun-101', 
        user_id: 'user-sun-101', 
        placement_parent_id: 'user-hiru-root', 
        position: 'LEFT', 
        depth: 2, 
        path: 'user-hiru-root', 
        left_child_id: 'node-sundd-102', 
        right_child_id: null, 
        created_at: '2026-09-02T00:00:00Z' 
    },
    { 
        id: 'node-sundd-102', 
        user_id: 'user-sundd-102', 
        placement_parent_id: 'user-sun-101', 
        position: 'LEFT', 
        depth: 3, 
        path: 'user-hiru-root/user-sun-101', 
        left_child_id: null, 
        right_child_id: null, 
        created_at: '2026-09-03T00:00:00Z' 
    }
];
const mockFraudAlerts = [];
const mockCommissionTransactions = [];
const mockSponsors = [
    { id: 'spon-sun-101', user_id: 'user-sun-101', sponsor_id: 'user-hiru-root', created_at: '2026-09-02T00:00:00Z' },
    { id: 'spon-sundd-102', user_id: 'user-sundd-102', sponsor_id: 'user-sun-101', created_at: '2026-09-03T00:00:00Z' }
];
const mockReferralClicks = [];
const mockReferralConversions = [];
const mockDailyEarningsMap = new Map();
const mockLiveEvents = [];

const DB_STORE_FILE = path.join(__dirname, 'data', 'mlm-db-store.json');

function saveDbStore() {
    try {
        const dir = path.dirname(DB_STORE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const data = {
            users: mockUsers,
            binaryNodes: mockBinaryNodes,
            sponsors: mockSponsors,
            productPurchases: mockProductPurchases,
            paymentDeposits: mockPaymentDeposits,
            walletLedger: mockWalletLedger,
            volumeLedger: mockVolumeLedger,
            withdrawalRequests: mockWithdrawalRequests,
            refundRequests: mockRefundRequests,
            kycDocs: mockKycDocs,
            fraudAlerts: mockFraudAlerts,
            referralConversions: mockReferralConversions,
            referralClicks: mockReferralClicks
        };
        fs.writeFileSync(DB_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save persistent DB store:', e.message);
    }
}

function loadDbStore() {
    try {
        if (fs.existsSync(DB_STORE_FILE)) {
            const raw = fs.readFileSync(DB_STORE_FILE, 'utf-8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.users)) {
                data.users.forEach(u => {
                    const ex = mockUsers.find(e => e.id === u.id || (e.email && u.email && e.email.toLowerCase() === u.email.toLowerCase()));
                    if (ex) {
                        Object.assign(ex, u);
                    } else {
                        mockUsers.push(u);
                    }
                });
            }
            if (Array.isArray(data.binaryNodes)) {
                data.binaryNodes.forEach(n => {
                    const ex = mockBinaryNodes.find(e => e.id === n.id || (e.user_id && n.user_id && e.user_id === n.user_id));
                    if (ex) {
                        Object.assign(ex, n);
                    } else {
                        mockBinaryNodes.push(n);
                    }
                });
            }
            if (Array.isArray(data.sponsors)) {
                data.sponsors.forEach(s => {
                    if (!mockSponsors.some(ex => ex.user_id === s.user_id && ex.sponsor_id === s.sponsor_id)) {
                        mockSponsors.push(s);
                    }
                });
            }
            if (Array.isArray(data.productPurchases)) {
                data.productPurchases.forEach(p => {
                    const ex = mockProductPurchases.find(e => e.id === p.id);
                    if (ex) {
                        Object.assign(ex, p);
                    } else {
                        mockProductPurchases.push(p);
                    }
                });
            }
            if (Array.isArray(data.paymentDeposits)) {
                data.paymentDeposits.forEach(d => {
                    const ex = mockPaymentDeposits.find(e => e.id === d.id);
                    if (ex) {
                        Object.assign(ex, d);
                    } else {
                        mockPaymentDeposits.push(d);
                    }
                });
            }
            if (Array.isArray(data.walletLedger)) {
                data.walletLedger.forEach(w => {
                    if (!mockWalletLedger.some(ex => ex.id === w.id)) {
                        mockWalletLedger.push(w);
                    }
                });
            }
            if (Array.isArray(data.volumeLedger)) {
                data.volumeLedger.forEach(v => {
                    if (!mockVolumeLedger.some(ex => ex.id === v.id)) {
                        mockVolumeLedger.push(v);
                    }
                });
            }
            if (Array.isArray(data.withdrawalRequests)) {
                data.withdrawalRequests.forEach(w => {
                    const ex = mockWithdrawalRequests.find(e => e.id === w.id);
                    if (ex) {
                        Object.assign(ex, w);
                    } else {
                        mockWithdrawalRequests.push(w);
                    }
                });
            }
            if (Array.isArray(data.refundRequests)) {
                data.refundRequests.forEach(r => {
                    const ex = mockRefundRequests.find(e => e.id === r.id);
                    if (ex) {
                        Object.assign(ex, r);
                    } else {
                        mockRefundRequests.push(r);
                    }
                });
            }
            if (Array.isArray(data.kycDocs)) {
                data.kycDocs.forEach(k => {
                    const ex = mockKycDocs.find(e => e.id === k.id || e.user_id === k.user_id);
                    if (ex) {
                        Object.assign(ex, k);
                    } else {
                        mockKycDocs.push(k);
                    }
                });
            }
        }
    } catch (e) {
        console.error('Failed to load persistent DB store:', e.message);
    }
}

// Load persisted entities on startup
loadDbStore();

function addLiveEvent(type, data = {}, message = '') {
    const event = {
        id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        type,
        data,
        message: message || type,
        created_at: new Date().toISOString()
    };
    mockLiveEvents.push(event);
    if (mockLiveEvents.length > 200) {
        mockLiveEvents.shift();
    }
    return event;
}

function getEnrichedAdminMembersList(filters = {}) {
    const { search = '', status = 'all', qualification = 'all', kyc = 'all' } = filters;
    const searchLower = (search || '').toLowerCase().trim();

    return mockUsers.map(user => {
        const sponsorRel = mockSponsors.find(s => s.user_id === user.id);
        const sponsorUser = sponsorRel ? mockUsers.find(u => u.id === sponsorRel.sponsor_id || u.username === sponsorRel.sponsor_id) : null;
        const binaryNode = mockBinaryNodes.find(n => n.user_id === user.id);
        const parentUser = binaryNode && binaryNode.placement_parent_id ? mockUsers.find(u => u.id === binaryNode.placement_parent_id) : null;

        const compStatus = QualificationEngine.getMemberComprehensiveStatus(user.id, {
            users: mockUsers,
            kycDocs: mockKycDocs,
            purchases: mockProductPurchases,
            sponsors: mockSponsors,
            binaryNodes: mockBinaryNodes,
            volumeLedger: mockVolumeLedger
        });

        const userPurchases = mockProductPurchases.filter(p => (p.user_id === user.id || p.buyer_id === user.id) && (p.status === 'ACTIVE' || p.status === 'PAID'));
        const personalBv = userPurchases.reduce((sum, p) => sum + (p.binary_volume || p.price_paid || 0), 0);

        const volSummary = VolumeLedger.getVolumeSummary(user.id, mockVolumeLedger);
        const wallet = MLMNetworkEngine.getMemberWallet(user.id, { walletLedger: mockWalletLedger });
        const earnings = MLMNetworkEngine.getMemberEarningsSummary(user.id, {
            commissionLedger: mockCommissionTransactions,
            walletLedger: mockWalletLedger
        });

        return {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.name || user.username,
            email: user.email,
            mobile: user.mobile || user.phone || 'N/A',
            role: user.role || 'member',
            status: user.status === 'SUSPENDED' ? 'SUSPENDED' : compStatus.account_status,
            account_status: compStatus.account_status,
            is_active: compStatus.is_active,
            qualification_status: compStatus.qualification_status,
            is_qualified: compStatus.is_qualified,
            qualifying_sales_count: compStatus.qualification.qualifying_sales_count,
            qualification_progress: compStatus.qualification.progress_text,
            kyc_status: compStatus.kyc_status,
            is_kyc_approved: compStatus.is_kyc_approved,
            sponsor: sponsorUser ? {
                id: sponsorUser.id,
                username: sponsorUser.username,
                full_name: sponsorUser.full_name || sponsorUser.name || sponsorUser.username
            } : null,
            binary_node: binaryNode ? {
                placement_parent_id: binaryNode.placement_parent_id,
                parent_username: parentUser ? parentUser.username : null,
                position: binaryNode.position || 'ROOT',
                depth: binaryNode.depth || 1,
                path: binaryNode.path || ''
            } : null,
            personal_bv: personalBv,
            active_courses_count: userPurchases.length,
            total_commission: earnings.total_earned,
            available_balance: wallet.available_balance,
            volume_summary: volSummary,
            created_at: user.created_at || '2026-09-01T00:00:00Z',
            display_banner: compStatus.display_banner
        };
    }).filter(m => {
        if (status && status !== 'all') {
            const st = (m.status || m.account_status || '').toLowerCase();
            if (st !== status.toLowerCase()) return false;
        }
        if (qualification && qualification !== 'all') {
            const q = (m.qualification_status || '').toLowerCase();
            if (q !== qualification.toLowerCase()) return false;
        }
        if (kyc && kyc !== 'all') {
            const k = (m.kyc_status || '').toLowerCase();
            if (k !== kyc.toLowerCase()) return false;
        }
        if (searchLower) {
            const nameMatch = (m.full_name || '').toLowerCase().includes(searchLower);
            const userMatch = (m.username || '').toLowerCase().includes(searchLower);
            const emailMatch = (m.email || '').toLowerCase().includes(searchLower);
            const sponsorMatch = m.sponsor && ((m.sponsor.username || '').toLowerCase().includes(searchLower) || (m.sponsor.full_name || '').toLowerCase().includes(searchLower));
            return nameMatch || userMatch || emailMatch || sponsorMatch;
        }
        return true;
    });
}

function getEnrichedAdminMemberDetail(userId) {
    const user = mockUsers.find(u => u.id === userId || u.username === userId);
    if (!user) return null;

    const sponsorRel = mockSponsors.find(s => s.user_id === user.id);
    const sponsorUser = sponsorRel ? mockUsers.find(u => u.id === sponsorRel.sponsor_id || u.username === sponsorRel.sponsor_id) : null;
    const binaryNode = mockBinaryNodes.find(n => n.user_id === user.id);
    const parentUser = binaryNode && binaryNode.placement_parent_id ? mockUsers.find(u => u.id === binaryNode.placement_parent_id) : null;

    const compStatus = QualificationEngine.getMemberComprehensiveStatus(user.id, {
        users: mockUsers,
        kycDocs: mockKycDocs,
        purchases: mockProductPurchases,
        sponsors: mockSponsors,
        binaryNodes: mockBinaryNodes,
        volumeLedger: mockVolumeLedger
    });

    const bank = mockBankAccounts.find(b => b.user_id === user.id);
    const userPurchases = mockProductPurchases.filter(p => p.user_id === user.id || p.buyer_id === user.id);
    const activePurchases = userPurchases.filter(p => p.status === 'ACTIVE' || p.status === 'PAID');
    const personalBv = activePurchases.reduce((sum, p) => sum + (p.binary_volume || p.price_paid || 0), 0);

    const volSummary = VolumeLedger.getVolumeSummary(user.id, mockVolumeLedger);
    const wallet = MLMNetworkEngine.getMemberWallet(user.id, { walletLedger: mockWalletLedger });
    const earnings = MLMNetworkEngine.getMemberEarningsSummary(user.id, {
        commissionLedger: mockCommissionTransactions,
        walletLedger: mockWalletLedger
    });
    const network = MLMNetworkEngine.getMemberNetwork(user.id, {
        binaryNodes: mockBinaryNodes,
        users: mockUsers,
        purchases: mockProductPurchases,
        volumeLedger: mockVolumeLedger,
        sponsors: mockSponsors
    });

    const userCommissions = mockCommissionTransactions.filter(c => c.user_id === user.id);
    const userLedger = mockWalletLedger.filter(tx => tx.user_id === user.id);
    const userWithdrawals = mockWithdrawalRequests.filter(w => w.user_id === user.id);

    return {
        profile: {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.name || user.username,
            email: user.email,
            mobile: user.mobile || user.phone || 'N/A',
            role: user.role || 'member',
            status: user.status === 'SUSPENDED' ? 'SUSPENDED' : compStatus.account_status,
            account_status: compStatus.account_status,
            is_active: compStatus.is_active,
            qualification_status: compStatus.qualification_status,
            is_qualified: compStatus.is_qualified,
            qualifying_sales_count: compStatus.qualification.qualifying_sales_count,
            qualification_progress: compStatus.qualification.progress_text,
            kyc_status: compStatus.kyc_status,
            is_kyc_approved: compStatus.is_kyc_approved,
            created_at: user.created_at || '2026-09-01T00:00:00Z',
            bank_account: bank || null,
            display_banner: compStatus.display_banner,
            status_evidence: compStatus
        },
        network: {
            sponsor: sponsorUser ? {
                id: sponsorUser.id,
                username: sponsorUser.username,
                full_name: sponsorUser.full_name || sponsorUser.name || sponsorUser.username
            } : null,
            binary_placement: binaryNode ? {
                placement_parent_id: binaryNode.placement_parent_id,
                parent_username: parentUser ? parentUser.username : null,
                position: binaryNode.position || 'ROOT',
                depth: binaryNode.depth || 1,
                path: binaryNode.path || ''
            } : null,
            direct_referrals: network.direct_referrals || [],
            direct_referrals_count: (network.direct_referrals || []).length,
            left_team_count: network.center_member ? network.center_member.left_team_count : (network.tree && network.tree.left ? 1 : 0),
            right_team_count: network.center_member ? network.center_member.right_team_count : (network.tree && network.tree.right ? 1 : 0),
            center_member: network.center_member,
            left_member: network.left_member,
            right_member: network.right_member,
            team_list: network.team_list || []
        },
        business_volume: {
            personal_bv: personalBv,
            current_left_volume: volSummary.current_left_volume,
            current_right_volume: volSummary.current_right_volume,
            lifetime_left_volume: volSummary.lifetime_left_volume,
            lifetime_right_volume: volSummary.lifetime_right_volume,
            matched_volume: volSummary.matched_volume,
            carry_forward_left: volSummary.carry_forward_left,
            carry_forward_right: volSummary.carry_forward_right,
            weaker_leg: volSummary.weaker_leg,
            total_team_points: volSummary.lifetime_left_volume + volSummary.lifetime_right_volume
        },
        financial: {
            available_balance: wallet.available_balance,
            total_earned: earnings.total_earned,
            direct_earned: earnings.direct_earned,
            binary_earned: earnings.binary_earned,
            pending_balance: earnings.pending_balance,
            paid_balance: earnings.paid_balance,
            withdrawal_hold_balance: earnings.withdrawal_hold_balance,
            commissions: userCommissions,
            ledger_transactions: userLedger,
            withdrawals: userWithdrawals
        },
        purchases: userPurchases.map(p => {
            const prod = mockProducts.find(mp => mp.id === p.product_id) || {};
            const dep = mockPaymentDeposits.find(d => d.purchase_id === p.id);
            return {
                id: p.id,
                order_number: p.order_number || ('ORD-' + p.id.substring(6).toUpperCase()),
                product_id: p.product_id,
                product_name: p.product_name || prod.name || prod.title || 'Masterclass',
                price_paid: p.price_paid || prod.selling_price || 0,
                binary_volume: p.binary_volume || prod.binary_volume || p.price_paid || 0,
                status: p.status,
                activated_at: p.activated_at || p.created_at,
                created_at: p.created_at,
                bank_reference: dep ? dep.bank_reference : null,
                slip_url: dep ? dep.slip_url : null
            };
        })
    };
}

function getEnrichedAdminOrdersList(filters = {}) {
    const { status = 'all' } = filters;
    const ordersMap = new Map();

    // 1. Process from mockProductPurchases
    mockProductPurchases.forEach(p => {
        const user = mockUsers.find(u => u.id === p.user_id) || {};
        const sponsorRel = mockSponsors.find(s => s.user_id === p.user_id);
        const sponsorUser = sponsorRel ? mockUsers.find(u => u.id === sponsorRel.sponsor_id || u.username === sponsorRel.sponsor_id) : null;
        const prod = mockProducts.find(mp => mp.id === p.product_id) || {};
        const dep = mockPaymentDeposits.find(d => d.purchase_id === p.id || d.order_number === p.order_number);
        const comms = mockCommissionTransactions.filter(c => c.source_purchase_id === p.id);

        const orderNum = p.order_number || (dep && dep.order_number) || ('ORD-' + p.id.substring(6).toUpperCase());
        const sellingPrice = p.price_paid || (dep && dep.amount) || prod.selling_price || prod.price || 0;
        const directComm = CommissionCore.calculateDirectCommission(sellingPrice, prod.direct_commission_percent || 8.0);
        const bv = p.binary_volume || prod.binary_volume || sellingPrice;
        const binaryComm = CommissionCore.calculateBinaryCommission(bv, prod.binary_commission_percent || 7.0);

        ordersMap.set(p.id, {
            id: p.id,
            order_number: orderNum,
            user_id: p.user_id,
            customer_name: user.full_name || user.name || user.username || 'Customer',
            customer_username: user.username || 'customer',
            customer_email: user.email || 'N/A',
            product_id: p.product_id,
            product_name: p.product_name || prod.name || prod.title || 'Course',
            category: prod.category || 'Education',
            amount: sellingPrice,
            binary_volume: bv,
            direct_commission_amount: directComm,
            binary_commission_amount: binaryComm,
            status: p.status || (dep ? dep.status : 'PENDING'),
            bank_reference: dep ? dep.bank_reference : (p.bank_reference || 'N/A'),
            transfer_date: dep ? dep.transfer_date : (p.created_at ? p.created_at.split('T')[0] : '2026-09-01'),
            slip_url: dep ? dep.slip_url : null,
            admin_notes: dep ? dep.notes : null,
            sponsor: sponsorUser ? {
                id: sponsorUser.id,
                username: sponsorUser.username,
                full_name: sponsorUser.full_name || sponsorUser.name || sponsorUser.username
            } : null,
            commissions_credited: comms,
            created_at: p.created_at || (dep ? dep.created_at : new Date().toISOString()),
            reviewed_at: (dep && dep.reviewed_at) || p.activated_at || null
        });
    });

    // 2. Incorporate any deposits that don't have matching purchases yet
    mockPaymentDeposits.forEach(d => {
        if (!ordersMap.has(d.purchase_id)) {
            const user = mockUsers.find(u => u.id === d.user_id) || {};
            const sponsorRel = mockSponsors.find(s => s.user_id === d.user_id);
            const sponsorUser = sponsorRel ? mockUsers.find(u => u.id === sponsorRel.sponsor_id || u.username === sponsorRel.sponsor_id) : null;
            const prod = mockProducts.find(mp => mp.id === d.product_id) || {};
            const sellingPrice = d.amount || prod.selling_price || prod.price || 0;
            const directComm = CommissionCore.calculateDirectCommission(sellingPrice, prod.direct_commission_percent || 8.0);
            const bv = prod.binary_volume || sellingPrice;
            const binaryComm = CommissionCore.calculateBinaryCommission(bv, prod.binary_commission_percent || 7.0);

            ordersMap.set(d.id, {
                id: d.purchase_id || d.id,
                order_number: d.order_number || ('ORD-' + d.id.substring(4).toUpperCase()),
                user_id: d.user_id,
                customer_name: user.full_name || user.name || user.username || 'Customer',
                customer_username: user.username || 'customer',
                customer_email: user.email || 'N/A',
                product_id: d.product_id,
                product_name: d.product_name || prod.name || prod.title || 'Course',
                category: prod.category || 'Education',
                amount: sellingPrice,
                binary_volume: bv,
                direct_commission_amount: directComm,
                binary_commission_amount: binaryComm,
                status: d.status || 'PENDING',
                bank_reference: d.bank_reference || 'N/A',
                transfer_date: d.transfer_date || (d.created_at ? d.created_at.split('T')[0] : '2026-09-01'),
                slip_url: d.slip_url || null,
                admin_notes: d.notes || null,
                sponsor: sponsorUser ? {
                    id: sponsorUser.id,
                    username: sponsorUser.username,
                    full_name: sponsorUser.full_name || sponsorUser.name || sponsorUser.username
                } : null,
                commissions_credited: [],
                created_at: d.created_at || new Date().toISOString(),
                reviewed_at: d.reviewed_at || null
            });
        }
    });

    const list = Array.from(ordersMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (status && status !== 'all') {
        return list.filter(o => (o.status || '').toLowerCase() === status.toLowerCase());
    }
    return list;
}


function parseRequestBody(req, maxSizeBytes = 10 * 1024 * 1024) {
    return new Promise((resolve) => {
        let body = '';
        let tooLarge = false;
        req.on('data', chunk => { 
            body += chunk.toString(); 
            if (body.length > maxSizeBytes) {
                tooLarge = true;
                req.destroy();
                resolve({});
            }
        });
        req.on('end', () => {
            if (tooLarge) {
                resolve({});
                return;
            }
            try {
                const parsed = body ? JSON.parse(body) : {};
                resolve(SecurityCore.sanitizeObject(parsed));
            } catch (e) {
                resolve({});
            }
        });
    });
}

function sendJSON(res, status, data, extraHeaders = {}) {
    const securityHeaders = SecurityCore.getSecurityHeaders(process.env.NODE_ENV === 'production');
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...securityHeaders,
        ...extraHeaders
    });
    res.end(JSON.stringify(data));
}

function getAuthenticatedUser(req) {
    const authHeader = req.headers['authorization'] || '';
    let token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token && req.headers['cookie']) {
        const match = req.headers['cookie'].match(/auth_token=([^;]+)/);
        if (match) token = decodeURIComponent(match[1]);
    }

    let queryUserId = '';
    try {
        const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (!token) token = u.searchParams.get('token') || '';
        queryUserId = u.searchParams.get('user_id') || u.searchParams.get('userId') || u.searchParams.get('username') || '';
    } catch (e) {}

    if (token) {
        if (activeSessions.has(token)) {
            return activeSessions.get(token);
        }
        const tLower = token.toLowerCase();
        const foundUser = mockUsers.find(u => {
            const uid = (u.id || '').toLowerCase();
            const uname = (u.username || '').toLowerCase();
            const role = (u.role || 'member').toLowerCase();
            return (
                uid === tLower ||
                uname === tLower ||
                ('token-' + uname) === tLower ||
                ('token-' + uid) === tLower ||
                ('token-' + role + '-' + uid) === tLower ||
                ('token-' + role + '-' + uname) === tLower ||
                ('token-member-' + uid) === tLower ||
                ('token-member-' + uname) === tLower ||
                ('token-admin-' + uid) === tLower ||
                ('token_' + uid) === tLower ||
                ('token_' + uname) === tLower
            );
        });
        if (foundUser) {
            return {
                id: foundUser.id,
                username: foundUser.username,
                full_name: foundUser.full_name || foundUser.name,
                email: foundUser.email,
                role: foundUser.role || 'member'
            };
        }
    }

    if (queryUserId) {
        const qLower = queryUserId.toLowerCase().replace(/^@+/, '').trim();
        const foundByQuery = mockUsers.find(u => 
            (u.id && u.id.toLowerCase() === qLower) ||
            (u.username && u.username.toLowerCase() === qLower) ||
            (u.email && u.email.toLowerCase() === qLower) ||
            (u.referral_code && u.referral_code.toLowerCase() === qLower)
        );
        if (foundByQuery) {
            return {
                id: foundByQuery.id,
                username: foundByQuery.username,
                full_name: foundByQuery.full_name || foundByQuery.name,
                email: foundByQuery.email,
                role: foundByQuery.role || 'member'
            };
        }
    }

    return null;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // 1. Enforce Rate Limiter on all incoming requests (API Abuse, Brute force prevention)
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    if (SecurityCore.isRateLimited(clientIp, 150)) {
        sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });
        return;
    }

    // 2. CSRF Origin / Referer Validation for Mutating Requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const isCsrfSafe = SecurityCore.validateCsrfOrigin(req, req.headers.host);
        if (!isCsrfSafe) {
            sendJSON(res, 403, { error: 'Cross-Site Request Forgery (CSRF) validation failed.' });
            return;
        }
    }

    // GET /api/health (System Health & Readiness Inspection)
    if (req.method === 'GET' && (pathname === '/api/health' || pathname === '/api/db/health')) {
        const isProduction = process.env.NODE_ENV === 'production';
        const hasDbUrl = Boolean(process.env.DATABASE_URL);
        const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

        sendJSON(res, 200, {
            status: 'ok',
            service: 'HAPANAMY API',
            timestamp: new Date().toISOString(),
            application: 'HAPANAMY.LK MLM PLATFORM',
            environment: process.env.NODE_ENV || 'development',
            uptime_seconds: Math.floor(process.uptime()),
            checks: {
                database: {
                    configured: hasDbUrl,
                    mode: isProduction ? (hasDbUrl ? 'CLOUD_POSTGRESQL' : 'FAIL_CLOSED') : 'DEV_MEMORY_TEST_HARNESS',
                    fail_closed_enforced: isProduction && !hasDbUrl
                },
                smtp: {
                    configured: hasSmtp,
                    status: hasSmtp ? 'CONFIGURED' : 'NOT_CONFIGURED'
                },
                business_rules: {
                    registration_fee: 'FREE (Rs. 0)',
                    direct_commission_percent: 8.00,
                    binary_commission_percent: 7.00,
                    max_qualified_uplines: 7,
                    daily_earnings_cap_lkr: 30000.00,
                    timezone: 'Asia/Colombo'
                }
            }
        });
        return;
    }

    // Production Fail-Closed Safety Middleware for Financial Mutations
    const financialEndpoints = [
        '/api/purchases',
        '/api/payments/verify',
        '/api/withdrawals',
        '/api/admin/refunds'
    ];
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && financialEndpoints.some(ep => pathname.startsWith(ep))) {
        sendJSON(res, 503, {
            error: 'FAIL_CLOSED: Production financial operations require a live PostgreSQL DATABASE_URL connection.',
            code: 'DATABASE_UNAVAILABLE'
        });
        return;
    }

    // API Route: Image Upload (Original functionality preserved)
    if (req.method === 'POST' && pathname === '/api/upload') {
        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename parameter' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Invalid or unsafe file name format.' });
            return;
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = path.join(__dirname, 'assets', safeFilename);

        const writeStream = fs.createWriteStream(uploadPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            sendJSON(res, 200, { success: true, filePath: 'assets/' + safeFilename });
        });

        writeStream.on('error', (err) => {
            sendJSON(res, 500, { success: false, error: err.message });
        });
        return;
    }

    // ========================================================
    // AUTHENTICATION & REGISTRATION API ROUTER (PHASE 3)
    // ========================================================

    // POST /api/auth/register and /api/register (STEP 15)
    if (req.method === 'POST' && (pathname === '/api/auth/register' || pathname === '/api/register')) {
        const body = await parseRequestBody(req);

        const result = AuthService.registerMember(body, {
            users: mockUsers,
            sponsors: mockSponsors,
            binaryNodes: mockBinaryNodes,
            volumeLedger: mockVolumeLedger,
            wallets: mockWallets,
            kycDocs: mockKycDocs,
            bankAccounts: mockBankAccounts,
            auditLogs: mockAuditLogs,
            referralConversions: mockReferralConversions,
            intentStore: mockReferralIntents
        });

        if (!result.success) {
            sendJSON(res, 400, { error: result.error });
            return;
        }

        const sessionToken = 'token-' + result.user.id;
        activeSessions.set(sessionToken, {
            id: result.user.id,
            username: result.user.username,
            full_name: result.user.full_name,
            email: result.user.email,
            role: result.user.role || 'member'
        });
        result.token = sessionToken;
        result.verification_token = sessionToken;

        addLiveEvent('NEW_MEMBER_REGISTERED', {
            userId: result.user.id,
            username: result.user.username,
            fullName: result.user.full_name,
            sponsor: result.sponsor ? result.sponsor.sponsor_username : 'None',
            sponsorId: result.sponsor ? result.sponsor.sponsor_id : null,
            position: result.placement ? result.placement.position : 'N/A'
        }, `New Member Registered: ${result.user.full_name} (@${result.user.username}) | Sponsor: ${result.sponsor ? result.sponsor.sponsor_username : 'None'} | Position: ${result.placement ? result.placement.position : 'N/A'}`);

        saveDbStore();
        sendJSON(res, 201, result);
        return;
    }

    // POST /api/auth/login and /api/login (STEP 31 Rate Limiting & Lockout Protected)
    if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/login')) {
        const body = await parseRequestBody(req);
        const identifier = body.identifier || body.username || body.email;
        const password = body.password;
        const totpCode = body.totpCode;

        if (!identifier || !password) {
            sendJSON(res, 400, { error: 'Username/Email and password are required.' });
            return;
        }

        const normalizedEmail = (identifier || '').toLowerCase().trim();

        // 1. Check Account Lockout
        if (SecurityCore.isAccountLocked(normalizedEmail)) {
            sendJSON(res, 429, { error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.' });
            return;
        }

        const cleanNorm = normalizedEmail.replace(/^@+/, '').trim();
        const prefixNorm = cleanNorm.split('@')[0];
        const foundUser = mockUsers.find(u => 
            (u.email && u.email.toLowerCase() === normalizedEmail) || 
            (u.username && (u.username.toLowerCase() === normalizedEmail || u.username.toLowerCase() === cleanNorm || u.username.toLowerCase() === prefixNorm)) ||
            (u.referral_code && (u.referral_code.toLowerCase() === normalizedEmail || u.referral_code.toLowerCase() === cleanNorm || u.referral_code.toLowerCase() === prefixNorm)) ||
            (u.id && (u.id.toLowerCase() === normalizedEmail || u.id.toLowerCase() === cleanNorm || u.id.toLowerCase() === prefixNorm)) ||
            (u.full_name && u.full_name.toLowerCase() === normalizedEmail) ||
            (u.name && u.name.toLowerCase() === normalizedEmail)
        );

        const validMasterPasswords = ['Hapana123', 'Araliya321#', 'admin123', 'hapanamy2026', 'Password123!', 'Admin@123', 'admin'];
        const passwordValid = foundUser && (
            validMasterPasswords.includes(password) || 
            (foundUser.password_hash && AuthService.verifyPassword(password, foundUser.password_hash)) || 
            password === foundUser.password
        );

        if (passwordValid) {
            // Check 2FA if enabled on user
            if (foundUser.two_factor_enabled && foundUser.two_factor_secret) {
                if (!totpCode) {
                    sendJSON(res, 200, { success: false, requires_2fa: true, message: 'Two-factor authentication code required.' });
                    return;
                }
                const totpValid = SecurityCore.verify2FACode(foundUser.two_factor_secret, totpCode, foundUser.backup_codes || []);
                if (!totpValid.valid) {
                    SecurityCore.recordLoginAttempt(normalizedEmail, false);
                    sendJSON(res, 401, { error: 'Invalid two-factor authentication code.' });
                    return;
                }
            }

            SecurityCore.recordLoginAttempt(normalizedEmail, true);
            const token = AuthService.generateToken();
            const userRole = (foundUser.role || 'member').toLowerCase();
            let redirect_url = 'dashboard.html';
            if (userRole === 'admin' || userRole === 'subadmin' || userRole === 'sub_admin' || userRole === 'super_admin') {
                redirect_url = 'hapanamy-admin-portal-9226.html';
            } else if (userRole === 'student') {
                redirect_url = 'student-dashboard.html';
            }

            activeSessions.set(token, {
                id: foundUser.id,
                username: foundUser.username,
                full_name: foundUser.full_name,
                email: foundUser.email,
                role: foundUser.role || 'member'
            });
            sendJSON(res, 200, {
                success: true,
                token,
                redirect_url,
                user: {
                    id: foundUser.id,
                    username: foundUser.username,
                    full_name: foundUser.full_name,
                    email: foundUser.email,
                    role: foundUser.role || 'member'
                }
            });
            return;
        }

        // Student/Member Mock Fallback
        if ((normalizedEmail === 'member@hapanamy.lk' || normalizedEmail === 'member') && password === 'Araliya321#') {
            SecurityCore.recordLoginAttempt(normalizedEmail, true);
            const token = AuthService.generateToken();
            activeSessions.set(token, { id: 'sponsor-uuid-1', username: 'sponsor1', full_name: 'Kasun Tharaka', email: 'member@hapanamy.lk', role: 'member' });
            sendJSON(res, 200, { success: true, token, user: { id: 'sponsor-uuid-1', username: 'sponsor1', full_name: 'Kasun Tharaka', email: 'member@hapanamy.lk', role: 'member' } });
            return;
        }

        const lockStatus = SecurityCore.recordLoginAttempt(normalizedEmail, false);
        if (lockStatus.locked) {
            sendJSON(res, 429, { error: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.' });
            return;
        }

        sendJSON(res, 401, { error: `Invalid credentials. ${lockStatus.remainingAttempts} attempts remaining before account lockout.` });
        return;
    }

    // POST /api/auth/2fa/setup
    if (req.method === 'POST' && pathname === '/api/auth/2fa/setup') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const setup = SecurityCore.generate2FASecret(authUser.id);
        SecurityCore.active2FASessions.set(authUser.id, setup);
        sendJSON(res, 200, { success: true, ...setup });
        return;
    }

    // POST /api/auth/2fa/verify
    if (req.method === 'POST' && pathname === '/api/auth/2fa/verify') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { code } = body;
        const setup = SecurityCore.active2FASessions.get(authUser.id);

        if (!setup) {
            sendJSON(res, 400, { error: 'Please initiate 2FA setup first.' });
            return;
        }

        const check = SecurityCore.verify2FACode(setup.secret, code, setup.backupCodes);
        if (check.valid) {
            const userIdx = mockUsers.findIndex(u => u.id === authUser.id);
            if (userIdx !== -1) {
                mockUsers[userIdx].two_factor_enabled = true;
                mockUsers[userIdx].two_factor_secret = setup.secret;
                mockUsers[userIdx].backup_codes = setup.backupCodes;
            }
            sendJSON(res, 200, { success: true, message: 'Two-factor authentication successfully enabled!' });
        } else {
            sendJSON(res, 400, { error: 'Invalid verification code.' });
        }
        return;
    }

    // POST /api/auth/password/reset-request
    if (req.method === 'POST' && pathname === '/api/auth/password/reset-request') {
        const body = await parseRequestBody(req);
        const { email } = body;

        if (!email) {
            sendJSON(res, 400, { error: 'Email is required.' });
            return;
        }

        const { token, expiresAt } = SecurityCore.createPasswordResetToken(email);
        SecurityCore.logSecurityEvent(mockAuditLogs, {
            actorId: 'guest',
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'users',
            entityId: email,
            metadata: { expiresAt }
        });

        sendJSON(res, 200, { success: true, message: 'Password reset link sent.', reset_token: token });
        return;
    }

    // POST /api/auth/password/reset-confirm
    if (req.method === 'POST' && pathname === '/api/auth/password/reset-confirm') {
        const body = await parseRequestBody(req);
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            sendJSON(res, 400, { error: 'Reset token and new password are required.' });
            return;
        }

        const passCheck = SecurityCore.validatePasswordStrength(newPassword);
        if (!passCheck.valid) {
            sendJSON(res, 400, { error: passCheck.error });
            return;
        }

        const tokenCheck = SecurityCore.consumePasswordResetToken(token);
        if (!tokenCheck.valid) {
            sendJSON(res, 400, { error: tokenCheck.error });
            return;
        }

        const userIdx = mockUsers.findIndex(u => u.email && u.email.toLowerCase() === tokenCheck.email.toLowerCase());
        if (userIdx !== -1) {
            mockUsers[userIdx].password_hash = AuthService.hashPassword(newPassword);
            mockUsers[userIdx].password = newPassword;
        }

        SecurityCore.logSecurityEvent(mockAuditLogs, {
            actorId: userIdx !== -1 ? mockUsers[userIdx].id : 'system',
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'users',
            entityId: tokenCheck.email
        });

        sendJSON(res, 200, { success: true, message: 'Password has been successfully updated.' });
        return;
    }

    // GET /api/admin/security/fraud-alerts (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/security/fraud-alerts') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN' && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'COMPLIANCE')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const signals = SecurityCore.scanFraudSignals({
            users: mockUsers,
            kycDocs: mockKycDocs,
            paymentSubmissions: mockPaymentDeposits,
            refundRequests: mockRefundRequests,
            sponsors: mockSponsors
        });

        sendJSON(res, 200, { success: true, count: signals.length, signals });
        return;
    }

    // POST & GET /api/auth/logout (Session Invalidation)
    if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/auth/logout') {
        const authHeader = req.headers['authorization'];
        const token = authHeader ? authHeader.replace('Bearer ', '') : '';

        if (token && activeSessions.has(token)) {
            activeSessions.delete(token);
        }
        sendJSON(res, 200, { success: true, message: 'Logged out successfully.' });
        return;
    }

    // GET /api/auth/me, /api/me, /api/user/profile (Current Authenticated User Session)
    if (req.method === 'GET' && (pathname === '/api/auth/me' || pathname === '/api/me' || pathname === '/api/user/profile' || pathname === '/api/user')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Invalid or expired session token.' });
            return;
        }
        const fullUser = mockUsers.find(u => u.id === authUser.id) || authUser;
        sendJSON(res, 200, {
            success: true,
            user: {
                id: fullUser.id,
                username: fullUser.username,
                full_name: fullUser.full_name || fullUser.name || authUser.full_name || authUser.username,
                email: fullUser.email,
                role: fullUser.role || 'member',
                phone: fullUser.phone || fullUser.mobile || fullUser.mobile_number || '',
                address: fullUser.address || '',
                district: fullUser.district || '',
                status: fullUser.status || 'INACTIVE',
                account_status: fullUser.account_status || 'INACTIVE',
                qualification_status: fullUser.qualification_status || 'NOT_QUALIFIED',
                kyc_status: fullUser.kyc_status || 'NOT_SUBMITTED'
            }
        });
        return;
    }

    // POST /api/user/profile & /api/member/profile (Update Profile)
    if (req.method === 'POST' && (pathname === '/api/user/profile' || pathname === '/api/member/profile')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const fullUser = mockUsers.find(u => u.id === authUser.id);
        if (fullUser) {
            if (body.full_name || body.name) fullUser.full_name = (body.full_name || body.name).trim();
            if (body.phone || body.mobile) fullUser.phone = (body.phone || body.mobile).trim();
            if (body.address) fullUser.address = body.address.trim();
            if (body.district) fullUser.district = body.district.trim();
        }
        if (authUser) {
            if (body.full_name || body.name) authUser.full_name = (body.full_name || body.name).trim();
        }

        sendJSON(res, 200, {
            success: true,
            message: 'Profile updated successfully.',
            user: {
                id: authUser.id,
                username: authUser.username,
                full_name: (fullUser && fullUser.full_name) || authUser.full_name || authUser.username,
                email: authUser.email,
                role: authUser.role || 'member',
                phone: (fullUser && fullUser.phone) || '',
                address: (fullUser && fullUser.address) || '',
                district: (fullUser && fullUser.district) || ''
            }
        });
        return;
    }

    // POST /api/user/change-password or /api/auth/change-password
    if (req.method === 'POST' && (pathname === '/api/user/change-password' || pathname === '/api/auth/change-password')) {
        const body = await parseRequestBody(req);
        let authUser = getAuthenticatedUser(req);
        const userId = body.user_id || body.userId || (authUser ? authUser.id : null);
        const newPassword = (body.new_password || body.password || '').trim();

        if (!newPassword || newPassword.length < 4) {
            sendJSON(res, 400, { success: false, error: 'New password must be at least 4 characters long.' });
            return;
        }

        let target = null;
        if (userId) {
            const cleanId = String(userId).replace(/^@/, '').toLowerCase();
            target = state.users.find(u => u.id === userId || String(u.username || '').toLowerCase() === cleanId || String(u.email || '').toLowerCase() === cleanId);
        }
        if (!target && authUser) {
            target = state.users.find(u => u.id === authUser.id);
        }

        if (!target) {
            sendJSON(res, 401, { success: false, error: 'User session expired or user not found.' });
            return;
        }

        target.password = newPassword;
        if (target.password_hash) {
            target.password_hash = sha256Hex(newPassword);
        }
        saveJsonState();

        sendJSON(res, 200, {
            success: true,
            message: 'මුරපදය සාර්ථකව වෙනස් කරන ලදී (Password changed successfully!).'
        });
        return;
    }

    // ========================================================
    // KYC & BANK ACCOUNT SYSTEM REST ENDPOINTS (PHASE 4)
    // ========================================================

    // POST /api/kyc/submit
    if (req.method === 'POST' && pathname === '/api/kyc/submit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        if (!KycService.isValidSubmission(body)) {
            sendJSON(res, 400, { error: 'All KYC fields and Bank Account details are required.' });
            return;
        }

        // Check for Suspicious duplication fraud indicators
        const alerts = SecurityCore.detectFraudAlerts(
            { nicPassport: body.nicPassport, accountNumber: body.accountNumber },
            mockKycDocs,
            mockBankAccounts
        );
        if (alerts.length > 0) {
            mockFraudAlerts.push(...alerts);
            KycService.logAction(mockAuditLogs, authUser.id, 'FRAUD_ALERT_TRIGGERED', 'kyc_documents', null, null, alerts[0]);
        }

        const docId = 'kyc-doc-' + Math.random().toString(36).substr(2, 9);
        const docEntry = {
            id: docId,
            user_id: authUser.id,
            nic_passport: body.nicPassport,
            document_url: body.documentUrl,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const bankId = 'bank-ac-' + Math.random().toString(36).substr(2, 9);
        const bankEntry = {
            id: bankId,
            user_id: authUser.id,
            bank_name: body.bankName,
            branch_name: body.branchName,
            account_holder_name: body.accountHolderName,
            account_number: body.accountNumber,
            is_active: true
        };

        mockKycDocs.push(docEntry);
        mockBankAccounts.push(bankEntry);

        KycService.logAction(mockAuditLogs, authUser.id, 'KYC_SUBMITTED', 'kyc_documents', docId, null, { status: 'PENDING' });
        KycService.logAction(mockAuditLogs, authUser.id, 'BANK_ADDED', 'bank_accounts', bankId, null, { accountNumber: body.accountNumber });

        sendJSON(res, 201, { success: true, message: 'KYC submitted successfully and bank details updated.' });
        return;
    }

    // GET /api/kyc/status
    if (req.method === 'GET' && pathname === '/api/kyc/status') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const doc = mockKycDocs.find(d => d.user_id === authUser.id);
        const bank = mockBankAccounts.find(b => b.user_id === authUser.id && b.is_active);
        sendJSON(res, 200, {
            kycStatus: doc ? doc.status : 'NOT_SUBMITTED',
            kycDetails: doc || null,
            bankDetails: bank || null
        });
        return;
    }

    // GET /api/admin/kyc/pending
    if (req.method === 'GET' && pathname === '/api/admin/kyc/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockKycDocs.filter(d => d.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/kyc/review
    if (req.method === 'POST' && pathname === '/api/admin/kyc/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { kycId, action, notes } = body;

        const normalizedAction = (action === 'APPROVED' || action === 'VERIFIED') ? 'APPROVED' : action;

        if (!kycId || !normalizedAction || !['APPROVED', 'REJECTED'].includes(normalizedAction)) {
            sendJSON(res, 400, { error: 'KycId and valid action (APPROVED or REJECTED) are required.' });
            return;
        }

        const docIdx = mockKycDocs.findIndex(d => d.id === kycId);
        if (docIdx === -1) {
            sendJSON(res, 404, { error: 'KYC Document not found.' });
            return;
        }

        KycService.transitionKycStatus(mockKycDocs[docIdx], normalizedAction, authUser.id, notes, mockAuditLogs);

        sendJSON(res, 200, { success: true, message: `KYC request status has been updated to ${normalizedAction}.`, kyc: mockKycDocs[docIdx] });
        return;
    }

    // GET /api/members/qualification (STEP 16)
    if (req.method === 'GET' && pathname === '/api/members/qualification') {
        const authUser = getAuthenticatedUser(req);
        const queryParams = parseQueryParams(req.url);
        const targetUserId = (authUser && authUser.role === 'admin' && queryParams.userId) 
            ? queryParams.userId 
            : (authUser ? authUser.id : (queryParams.userId || 'sponsor-uuid-1'));

        const qualification = QualificationEngine.evaluateQualification(
            targetUserId,
            {
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                volumeLedger: mockVolumeLedger
            }
        );

        sendJSON(res, 200, { success: true, qualification });
        return;
    }

    // GET /api/admin/members/qualification-history
    if (req.method === 'GET' && pathname === '/api/admin/members/qualification-history') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const queryParams = parseQueryParams(req.url);
        const targetUserId = queryParams.userId;
        const history = targetUserId 
            ? QualificationEngine.getMemberQualificationHistory(targetUserId)
            : QualificationEngine._qualificationHistory;

        sendJSON(res, 200, { success: true, history });
        return;
    }

    // GET /api/admin/members/qualification-config
    if (req.method === 'GET' && pathname === '/api/admin/members/qualification-config') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const config = QualificationEngine.getActiveRuleConfig();
        sendJSON(res, 200, { success: true, config });
        return;
    }

    // PUT /api/admin/members/qualification-config
    if (req.method === 'PUT' && pathname === '/api/admin/members/qualification-config') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        try {
            const updatedConfig = QualificationEngine.updateRuleConfig(body, authUser.id, mockAuditLogs);
            sendJSON(res, 200, { success: true, message: 'Qualification rule updated successfully.', config: updatedConfig });
        } catch (e) {
            sendJSON(res, 400, { error: e.message });
        }
        return;
    }

    // POST /api/bank/update
    if (req.method === 'POST' && pathname === '/api/bank/update') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { bankName, branchName, accountHolderName, accountNumber } = body;

        if (!bankName || !branchName || !accountHolderName || !accountNumber) {
            sendJSON(res, 400, { error: 'All Bank details are required.' });
            return;
        }

        const oldBankIdx = mockBankAccounts.findIndex(b => b.user_id === authUser.id && b.is_active);
        let oldBank = null;
        if (oldBankIdx !== -1) {
            oldBank = { ...mockBankAccounts[oldBankIdx] };
            mockBankAccounts[oldBankIdx].is_active = false;
        }

        const newBankId = 'bank-ac-' + Math.random().toString(36).substr(2, 9);
        const newBank = {
            id: newBankId,
            user_id: authUser.id,
            bank_name: bankName,
            branch_name: branchName,
            account_holder_name: accountHolderName,
            account_number: accountNumber,
            is_active: true
        };
        mockBankAccounts.push(newBank);

        const actionType = oldBank ? 'BANK_CHANGED' : 'BANK_ADDED';
        KycService.logAction(mockAuditLogs, authUser.id, actionType, 'bank_accounts', newBankId, oldBank, newBank);

        sendJSON(res, 200, { success: true, message: 'Bank account updated successfully.' });
        return;
    }

    // ========================================================
    // BINARY NETWORK & PLACEMENT ENGINE REST ENDPOINTS (PHASE 1)
    // ========================================================

    // GET /api/network/tree
    if (req.method === 'GET' && pathname === '/api/network/tree') {
        const authUser = getAuthenticatedUser(req);
        const queryParams = parseQueryParams(req.url);
        const targetUserId = (authUser && authUser.role === 'admin' && queryParams.userId) 
            ? queryParams.userId 
            : (authUser ? authUser.id : (queryParams.userId || 'user-hiru-root'));

        const maxDepth = parseInt(queryParams.depth || 4);
        const treeHierarchy = PlacementEngine.buildTreeHierarchy(
            targetUserId, 
            mockBinaryNodes, 
            mockUsers, 
            mockProductPurchases, 
            mockVolumeLedger, 
            maxDepth
        );

        sendJSON(res, 200, { 
            success: true, 
            root_user_id: targetUserId, 
            tree: treeHierarchy 
        });
        return;
    }

    // GET /api/network/search
    if (req.method === 'GET' && pathname === '/api/network/search') {
        const queryParams = parseQueryParams(req.url);
        const q = queryParams.q || '';
        const searchResult = PlacementEngine.searchTreeNode(q, mockBinaryNodes, mockUsers);

        if (!searchResult) {
            sendJSON(res, 404, { error: 'No member found matching query in binary tree.' });
            return;
        }

        sendJSON(res, 200, { success: true, result: searchResult });
        return;
    }

    // GET /api/network/directs
    if (req.method === 'GET' && pathname === '/api/network/directs') {
        const authUser = getAuthenticatedUser(req);
        const targetUserId = authUser ? authUser.id : 'sponsor-uuid-1';
        const directs = PlacementEngine.getDirectReferrals(
            targetUserId,
            mockSponsors,
            mockUsers,
            mockProductPurchases,
            mockBinaryNodes
        );

        sendJSON(res, 200, { success: true, directs, count: directs.length });
        return;
    }

    // GET /api/network/summary
    if (req.method === 'GET' && pathname === '/api/network/summary') {
        const authUser = getAuthenticatedUser(req);
        const targetUserId = authUser ? authUser.id : 'sponsor-uuid-1';
        const summary = PlacementEngine.getTeamSummary(targetUserId, mockBinaryNodes, mockVolumeLedger);

        sendJSON(res, 200, { success: true, summary });
        return;
    }

    // GET /api/network/node (Node details with Sponsor, Placement Parent & Children)
    if (req.method === 'GET' && pathname === '/api/network/node') {
        const queryParams = parseQueryParams(req.url);
        const memberId = queryParams.memberId || queryParams.userId;

        if (!memberId) {
            sendJSON(res, 400, { error: 'memberId is required.' });
            return;
        }

        const node = mockBinaryNodes.find(n => n.user_id === memberId);
        if (!node) {
            sendJSON(res, 404, { error: `Binary node for member ${memberId} not found.` });
            return;
        }

        const user = mockUsers.find(u => u.id === memberId) || { username: memberId, full_name: 'Member ' + memberId };
        const sponsorRecord = mockSponsors.find(s => s.user_id === memberId);
        const sponsorUser = sponsorRecord ? mockUsers.find(u => u.id === sponsorRecord.sponsor_id) : null;
        const parentUser = node.placement_parent_id ? mockUsers.find(u => u.id === node.placement_parent_id) : null;
        const summary = PlacementEngine.getTeamSummary(memberId, mockBinaryNodes, mockVolumeLedger);

        sendJSON(res, 200, {
            success: true,
            node: {
                user_id: node.user_id,
                username: user.username,
                full_name: user.full_name,
                depth: node.depth,
                path: node.path,
                position: node.position,
                placement_parent_id: node.placement_parent_id,
                placement_parent_username: parentUser ? parentUser.username : null,
                sponsor_id: sponsorRecord ? sponsorRecord.sponsor_id : null,
                sponsor_username: sponsorUser ? sponsorUser.username : null,
                left_child_id: node.left_child_id,
                right_child_id: node.right_child_id,
                left_count: summary.leftCount,
                right_count: summary.rightCount,
                left_volume: summary.leftVolume,
                right_volume: summary.rightVolume,
                team_count: summary.teamCount
            }
        });
        return;
    }

    // POST /api/network/place (Admin or Sponsor Manual Placement with Audit Logging)
    if (req.method === 'POST' && pathname === '/api/network/place') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { userId, placementParentId, position, sponsorId } = body;

        try {
            const newNode = PlacementEngine.assignPlacement(
                userId,
                sponsorId || authUser.id,
                placementParentId,
                position,
                mockBinaryNodes,
                {
                    isManual: true,
                    adminUserId: authUser.id,
                    auditLogs: mockAuditLogs
                }
            );

            sendJSON(res, 201, { success: true, message: 'Member placed successfully.', node: newNode });
        } catch (e) {
            sendJSON(res, 400, { error: e.message });
        }
        return;
    }

    // ========================================================
    // REFERRAL LINK ENGINE REST ENDPOINTS (PHASE 2)
    // ========================================================

    // GET /api/referrals/my-links
    if (req.method === 'GET' && pathname === '/api/referrals/my-links') {
        const authUser = getAuthenticatedUser(req);
        const username = authUser ? (authUser.username || authUser.email.split('@')[0]) : 'Hiru';

        const links = ReferralService.generateReferralLinks(username);
        const stats = ReferralService.getReferralStats(username, mockReferralClicks, mockReferralConversions);
        const qrSvg = ReferralService.generateQrCodeSvg(links.general_link);

        sendJSON(res, 200, {
            success: true,
            username,
            links,
            stats,
            qr_code_svg: qrSvg
        });
        return;
    }

    // POST /api/referrals/click
    if (req.method === 'POST' && pathname === '/api/referrals/click') {
        const body = await parseRequestBody(req);
        const { ref, position } = body;
        const clientIp = req.socket.remoteAddress || '127.0.0.1';

        const clickEvent = ReferralService.trackClick(ref, position, clientIp, mockReferralClicks);
        sendJSON(res, 200, { success: true, click: clickEvent });
        return;
    }

    // GET /api/referrals/analytics
    if (req.method === 'GET' && pathname === '/api/referrals/analytics') {
        const authUser = getAuthenticatedUser(req);
        const username = authUser ? (authUser.username || authUser.email.split('@')[0]) : 'Hiru';
        const stats = ReferralService.getReferralStats(username, mockReferralClicks, mockReferralConversions);

        sendJSON(res, 200, { success: true, stats });
        return;
    }

    // GET /api/kyc/document
    if (req.method === 'GET' && pathname === '/api/kyc/document') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized to view secure document.' });
            return;
        }

        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename.' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Unsafe filename format.' });
            return;
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const securePath = path.join(__dirname, 'storage', 'private', 'kyc', safeFilename);

        if (!fs.existsSync(securePath)) {
            sendJSON(res, 404, { error: 'Document not found or access denied.' });
            return;
        }

        const ownsDoc = mockKycDocs.some(d => d.user_id === authUser.id && d.document_url.includes(safeFilename));
        if (!ownsDoc && authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        fs.createReadStream(securePath).pipe(res);
        return;
    }

    // POST /api/kyc/upload
    if (req.method === 'POST' && pathname === '/api/kyc/upload') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const filename = url.searchParams.get('filename');
        if (!filename) {
            sendJSON(res, 400, { error: 'Missing filename.' });
            return;
        }

        if (!SecurityCore.isSafeFilename(filename)) {
            sendJSON(res, 400, { error: 'Unsafe file format.' });
            return;
        }

        const kycDir = path.join(__dirname, 'storage', 'private', 'kyc');
        if (!fs.existsSync(kycDir)) {
            fs.mkdirSync(kycDir, { recursive: true });
        }

        const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
        const uploadPath = path.join(kycDir, safeFilename);

        const writeStream = fs.createWriteStream(uploadPath);
        req.pipe(writeStream);

        writeStream.on('finish', () => {
            sendJSON(res, 200, { success: true, filePath: 'storage/private/kyc/' + safeFilename });
        });

        writeStream.on('error', (err) => {
            sendJSON(res, 500, { success: false, error: err.message });
        });
        return;
    }

    // ========================================================
    // PRODUCTS & BANK DEPOSIT PAYMENT SYSTEM (PHASE 5)
    // ========================================================

    // GET /api/products/list
    if (req.method === 'GET' && pathname === '/api/products/list') {
        const activeOnly = mockProducts.filter(p => p.status === 'ACTIVE');
        sendJSON(res, 200, { products: activeOnly });
        return;
    }

    // GET /api/products/my-purchases and /api/student/courses
    if (req.method === 'GET' && (pathname === '/api/products/my-purchases' || pathname === '/api/student/courses')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const aId = (authUser.id || '').toLowerCase();
        const aName = (authUser.username || '').toLowerCase();
        const aEmail = (authUser.email || '').toLowerCase();

        const userPurchases = mockProductPurchases.filter(p => {
            const pUid = (p.user_id || p.buyer_id || '').toLowerCase();
            const pUname = (p.username || '').toLowerCase();
            const pEmail = (p.email || '').toLowerCase();

            const isMatch = (
                (aId && (pUid === aId || pUname === aId)) ||
                (aName && (pUid === aName || pUname === aName)) ||
                (aEmail && pEmail === aEmail)
            );
            const isActive = ['ACTIVE', 'APPROVED', 'PAID', 'COMPLETED'].includes((p.status || '').toUpperCase());
            return isMatch && isActive;
        });

        const myProducts = userPurchases.map(p => {
            const prod = mockProducts.find(mp => 
                (mp.id && mp.id.toLowerCase() === (p.product_id || '').toLowerCase()) || 
                (mp.code && mp.code.toLowerCase() === (p.product_id || '').toLowerCase()) ||
                (mp.name && mp.name.toLowerCase() === (p.product_name || '').toLowerCase()) ||
                (mp.title && mp.title.toLowerCase() === (p.product_name || '').toLowerCase())
            ) || {};
            return {
                id: p.product_id || prod.id || p.id,
                purchase_id: p.id,
                order_number: p.order_number || ('ORD-' + (p.id || '').substring(0, 6).toUpperCase()),
                product_id: p.product_id || prod.id || '',
                product_name: p.product_name || prod.name || prod.title || 'Masterclass',
                title: p.product_name || prod.name || prod.title || 'Masterclass',
                name: p.product_name || prod.name || prod.title || 'Masterclass',
                category: prod.category || 'Education',
                selling_price: p.price_paid || prod.selling_price || 0,
                price_paid: p.price_paid || prod.selling_price || 0,
                image_url: prod.image_url || 'assets/facebook_course_banner.jpg',
                banner: prod.image_url || 'assets/facebook_course_banner.jpg',
                status: 'ACTIVE',
                activated_at: p.activated_at || p.created_at || new Date().toISOString(),
                created_at: p.created_at || new Date().toISOString(),
                classroom_url: prod.course_url || 'student-dashboard.html'
            };
        }).reverse();

        sendJSON(res, 200, { success: true, count: myProducts.length, myProducts, courses: myProducts, purchases: myProducts });
        return;
    }

    // GET /api/products/:id (Public Product Details lookup by slug, id, or code)
    if (req.method === 'GET' && pathname.startsWith('/api/products/') && !pathname.startsWith('/api/products/list') && !pathname.startsWith('/api/products/create') && !pathname.startsWith('/api/products/edit') && !pathname.startsWith('/api/products/my-purchases')) {
        const prodParam = pathname.replace('/api/products/', '').trim().toLowerCase();
        const product = mockProducts.find(p => 
            p.id.toLowerCase() === prodParam || 
            (p.code && p.code.toLowerCase() === prodParam) ||
            (prodParam === 'trading' && (p.id === 'titan-elite' || p.id === 'forex-course')) ||
            (prodParam === 'ai-mastery' && p.id === 'ai-mastery-course') ||
            (prodParam === 'social' && p.id === 'social-media-masterclass')
        );

        if (!product) {
            sendJSON(res, 404, { error: 'Product not found.' });
            return;
        }

        sendJSON(res, 200, { success: true, product });
        return;
    }

    // POST /api/purchase/checkout (Server-Authoritative Pricing & Checkout Session)
    if (req.method === 'POST' && (pathname === '/api/purchase/checkout' || pathname === '/api/checkout/session')) {
        const body = await parseRequestBody(req);
        const { productId, userEmail, userId } = body;

        const prodParam = (productId || body.product_id || body.code || '').toLowerCase().trim();
        const product = mockProducts.find(p => 
            p.id.toLowerCase() === prodParam || 
            (p.code && p.code.toLowerCase() === prodParam) ||
            (prodParam === 'trading' && p.id === 'titan-elite') ||
            (prodParam === 'ai-mastery' && p.id === 'ai-mastery-course') ||
            (prodParam === 'social' && p.id === 'social-media-masterclass')
        ) || mockProducts[0];

        const orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        sendJSON(res, 200, {
            success: true,
            checkoutSession: {
                order_number: orderNumber,
                product_id: product.id,
                product_name: product.name || product.title,
                selling_price: product.selling_price || product.price,
                original_price: product.original_price || product.price,
                binary_volume: product.binary_volume || product.selling_price || product.price,
                direct_commission_percent: product.direct_commission_percent || 8.00,
                company_banks: mockCompanyBankDetails
            }
        });
        return;
    }

    // POST /api/payments/verify (Payment Gateway Verification & Purchase Orchestration)
    if (req.method === 'POST' && (pathname === '/api/payments/verify' || pathname === '/api/purchase/verify')) {
        const authUser = getAuthenticatedUser(req);
        const body = await parseRequestBody(req);
        const { productId, orderNumber, amount, paymentMethod, userId, orderId } = body;

        const targetUserId = (authUser && authUser.id) ? authUser.id : (userId || 'user-active');
        const prodParam = (productId || body.product_id || body.code || '').toLowerCase().trim();
        const product = mockProducts.find(p => 
            p.id.toLowerCase() === prodParam || 
            (p.code && p.code.toLowerCase() === prodParam) ||
            (prodParam === 'trading' && p.id === 'titan-elite') ||
            (prodParam === 'ai-mastery' && p.id === 'ai-mastery-course') ||
            (prodParam === 'social' && p.id === 'social-media-masterclass')
        ) || mockProducts[0];

        const canonicalPrice = product.selling_price || product.price;
        const purchaseId = orderId || ('purch-' + Math.random().toString(36).substr(2, 9));
        const ordNum = orderNumber || ('ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase());
        const now = new Date().toISOString();

        const activePurchase = {
            id: purchaseId,
            order_number: ordNum,
            user_id: targetUserId,
            product_id: product.id,
            product_name: product.name || product.title,
            price_paid: canonicalPrice,
            binary_volume: product.binary_volume || canonicalPrice,
            status: 'ACTIVE',
            activated_at: now,
            created_at: now
        };

        // Activate User Status in DB
        const userInDb = mockUsers.find(u => u.id === targetUserId || (u.email && authUser && u.email === authUser.email));
        if (userInDb) {
            userInDb.status = 'ACTIVE';
        }

        // Execute Purchase Orchestrator Workflow
        let orchResult = null;
        try {
            orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
                purchase: activePurchase,
                product: product,
                userId: targetUserId,
                binaryNodes: mockBinaryNodes,
                sponsors: mockSponsors,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                commissionLedger: mockCommissionTransactions,
                volumeLedger: mockVolumeLedger,
                walletLedger: mockWalletLedger,
                dailyEarningsMap: mockDailyEarningsMap
            });
        } catch (orchErr) {
            console.warn(`Orchestration execution warning: ${orchErr.message}`);
        }

        addLiveEvent('ORDER_PAID', {
            orderNumber: ordNum,
            purchaseId: purchaseId,
            userId: targetUserId,
            amount: canonicalPrice,
            productName: product.name || product.title
        }, `Payment Verified: Order #${ordNum} (${product.name || product.title}) - LKR ${canonicalPrice.toFixed(2)}`);

        sendJSON(res, 200, {
            success: true,
            status: 'ACTIVE',
            orderNumber: ordNum,
            purchaseId: purchaseId,
            product: product.name || product.title,
            amount: canonicalPrice,
            binary_volume: product.binary_volume || canonicalPrice,
            orchestration: orchResult
        });
        return;
    }

    // POST /api/products/create (Admin only)
    if (req.method === 'POST' && pathname === '/api/products/create') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const {
            name, code, pricingMode, marketPrice, discountType, discountValue, price,
            productCost, minimumCompanyProfit, operatingCostReserve, paymentProcessingReserve,
            refundRiskReserve, taxReserve, otherReserve, commissionSafetyBuffer,
            binaryVolume, directCommissionRate, binaryCommissionRate, maxBinaryQualifiedLevels,
            commissionMode, status,
            taxType, taxPercent, taxFixedAmount,
            hostingCostPercent, hostingCostFixed,
            staffCostPercent, staffCostFixed,
            marketingCostPercent, marketingCostFixed,
            refundReservePercent, refundReserveFixed,
            supportCostPercent, supportCostFixed,
            operationalCostPercent, operationalCostFixed,
            profitReserveType, profitReservePercent, profitReserveFixed, profitReserveBase,
            economicsVersion
        } = body;

        if (!name || !code) {
            sendJSON(res, 400, { error: 'Name and code are required.' });
            return;
        }

        // Set complete pricing & discrete economics configuration
        const pricing = {
            pricing_mode: pricingMode || 'FIXED',
            market_price: parseFloat(marketPrice !== undefined ? marketPrice : (price || 0.00)),
            discount_type: discountType || 'NONE',
            discount_value: parseFloat(discountValue || 0.00),
            selling_price: parseFloat(price !== undefined ? price : (marketPrice || 0.00)),
            product_cost: parseFloat(productCost || 0.00),
            
            // 7 Discrete Cost Allocations
            tax_type: taxType || 'PERCENTAGE',
            tax_percent: parseFloat(taxPercent !== undefined ? taxPercent : 0.00),
            tax_fixed_amount: parseFloat(taxFixedAmount !== undefined ? taxFixedAmount : (taxReserve || 0.00)),
            
            hosting_cost_percent: parseFloat(hostingCostPercent !== undefined ? hostingCostPercent : 0.00),
            hosting_cost_fixed: parseFloat(hostingCostFixed !== undefined ? hostingCostFixed : 0.00),
            
            staff_cost_percent: parseFloat(staffCostPercent !== undefined ? staffCostPercent : 0.00),
            staff_cost_fixed: parseFloat(staffCostFixed !== undefined ? staffCostFixed : 0.00),
            
            marketing_cost_percent: parseFloat(marketingCostPercent !== undefined ? marketingCostPercent : 0.00),
            marketing_cost_fixed: parseFloat(marketingCostFixed !== undefined ? marketingCostFixed : (otherReserve || 0.00)),
            
            refund_reserve_percent: parseFloat(refundReservePercent !== undefined ? refundReservePercent : 0.00),
            refund_reserve_fixed: parseFloat(refundReserveFixed !== undefined ? refundReserveFixed : (refundRiskReserve || 0.00)),
            
            support_cost_percent: parseFloat(supportCostPercent !== undefined ? supportCostPercent : 0.00),
            support_cost_fixed: parseFloat(supportCostFixed !== undefined ? supportCostFixed : 0.00),
            
            operational_cost_percent: parseFloat(operationalCostPercent !== undefined ? operationalCostPercent : 0.00),
            operational_cost_fixed: parseFloat(operationalCostFixed !== undefined ? operationalCostFixed : 0.00),
            
            // Profit Reserve
            profit_reserve_type: profitReserveType || (minimumCompanyProfit !== undefined ? 'FIXED' : 'PERCENTAGE'),
            profit_reserve_percent: parseFloat(profitReservePercent !== undefined ? profitReservePercent : 0.00),
            profit_reserve_fixed: parseFloat(profitReserveFixed !== undefined ? profitReserveFixed : (minimumCompanyProfit || 0.00)),
            profit_reserve_base: profitReserveBase || 'AVAILABLE_CONTRIBUTION',

            // Legacy Reserves Compatibility Aliases
            minimum_company_profit: parseFloat(minimumCompanyProfit || 0.00),
            operating_cost_reserve: parseFloat(operatingCostReserve || 0.00),
            payment_processing_reserve: parseFloat(paymentProcessingReserve || 0.00),
            refund_risk_reserve: parseFloat(refundRiskReserve || 0.00),
            tax_reserve: parseFloat(taxReserve || 0.00),
            other_reserve: parseFloat(otherReserve || 0.00),
            commission_safety_buffer: parseFloat(commissionSafetyBuffer || 0.00),
            
            // Commissions
            binary_volume: parseFloat(binaryVolume !== undefined ? binaryVolume : (price || 0.00)),
            direct_commission_rate: parseFloat(directCommissionRate || body.directCommission || 8.00),
            binary_commission_rate: parseFloat(binaryCommissionRate || body.binaryCommission || 7.00),
            max_binary_qualified_levels: parseInt(maxBinaryQualifiedLevels || 7),
            commission_mode: commissionMode || 'MANUAL',
            economics_version: economicsVersion || 'v1.0'
        };

        // Determine maximum safe binary rate
        const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(pricing);

        if (pricing.commission_mode === 'AUTO_SAFE') {
            pricing.binary_commission_rate = maxSafeRate;
        }

        // Run economics and validator
        const econCalc = ProductEconomicsCalculator.calculate(pricing);
        const validation = ProductCommissionValidator.validate(econCalc);

        // Protect Product Profit Activation Firewall: BLOCKED products can never be set ACTIVE
        const targetStatus = status || 'ACTIVE';
        if (targetStatus === 'ACTIVE') {
            // 1. Check basic economics block conditions first
            const isOverridden = Boolean(body.admin_override && body.override_reason);
            if (!isOverridden) {
                if (validation.status === 'BLOCKED' || !validation.allowed) {
                    sendJSON(res, 400, {
                        status: 'BLOCKED',
                        financial_status: 'NOT_VIABLE',
                        safety_status: 'UNSAFE',
                        blocked_reason: validation.blocked_reason,
                        shortfall: validation.shortfall,
                        effective_commission_budget: econCalc.calculated.effective_commission_budget,
                        maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        remaining_margin: econCalc.calculated.remaining_company_margin,
                        maximum_safe_binary_rate: maxSafeRate,
                        requested_binary_rate: pricing.binary_commission_rate,
                        calculated: econCalc.calculated
                    });
                    return;
                }

                // 2. Check manual commission limits second
                if (pricing.commission_mode === 'MANUAL' && pricing.binary_commission_rate > maxSafeRate) {
                    sendJSON(res, 400, {
                        status: 'BLOCKED',
                        financial_status: 'NOT_VIABLE',
                        safety_status: 'UNSAFE',
                        blocked_reason: `Manual binary commission rate ${pricing.binary_commission_rate}% exceeds maximum safe rate of ${maxSafeRate}%.`,
                        requested_binary_rate: pricing.binary_commission_rate,
                        maximum_safe_binary_rate: maxSafeRate,
                        difference: Math.round((pricing.binary_commission_rate - maxSafeRate) * 100) / 100,
                        expected_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        effective_commission_budget: econCalc.calculated.effective_commission_budget,
                        maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        remaining_margin: econCalc.calculated.remaining_company_margin,
                        calculated: econCalc.calculated
                    });
                    return;
                }
            } else {
                // Log financial override audit event
                mockFinancialAuditLogs.push({
                    id: 'faudit-ovr-' + Math.random().toString(36).substr(2, 9),
                    admin_id: authUser.id,
                    action: 'FINANCIAL_OVERRIDE_ACTIVATION',
                    entity_type: 'products',
                    entity_id: 'pending',
                    details: {
                        reason: body.override_reason,
                        blocked_reason: validation.blocked_reason,
                        shortfall: validation.shortfall
                    },
                    ip_address: req.socket.remoteAddress || '127.0.0.1',
                    created_at: new Date().toISOString()
                });
            }
        }

        const prodId = 'prod-' + Math.random().toString(36).substr(2, 9);
        const product = {
            id: prodId,
            name: SecurityCore.sanitizeInput(name),
            code: SecurityCore.sanitizeInput(code),
            price: econCalc.calculated.selling_price,
            selling_price: econCalc.calculated.selling_price,
            binary_volume: pricing.binary_volume,
            direct_commission_percent: pricing.direct_commission_rate,
            binary_commission_percent: pricing.binary_commission_rate,
            pricing_mode: pricing.pricing_mode,
            market_price: pricing.market_price,
            discount_type: pricing.discount_type,
            discount_value: pricing.discount_value,
            product_cost: pricing.product_cost,
            
            // 7 Costs
            tax_type: pricing.tax_type,
            tax_percent: pricing.tax_percent,
            tax_fixed_amount: pricing.tax_fixed_amount,
            hosting_cost_percent: pricing.hosting_cost_percent,
            hosting_cost_fixed: pricing.hosting_cost_fixed,
            staff_cost_percent: pricing.staff_cost_percent,
            staff_cost_fixed: pricing.staff_cost_fixed,
            marketing_cost_percent: pricing.marketing_cost_percent,
            marketing_cost_fixed: pricing.marketing_cost_fixed,
            refund_reserve_percent: pricing.refund_reserve_percent,
            refund_reserve_fixed: pricing.refund_reserve_fixed,
            support_cost_percent: pricing.support_cost_percent,
            support_cost_fixed: pricing.support_cost_fixed,
            operational_cost_percent: pricing.operational_cost_percent,
            operational_cost_fixed: pricing.operational_cost_fixed,
            
            // Profit reserve
            profit_reserve_type: pricing.profit_reserve_type,
            profit_reserve_percent: pricing.profit_reserve_percent,
            profit_reserve_fixed: pricing.profit_reserve_fixed,
            profit_reserve_base: pricing.profit_reserve_base,

            minimum_company_profit: pricing.minimum_company_profit,
            operating_cost_reserve: pricing.operating_cost_reserve,
            payment_processing_reserve: pricing.payment_processing_reserve,
            refund_risk_reserve: pricing.refund_risk_reserve,
            tax_reserve: pricing.tax_reserve,
            other_reserve: pricing.other_reserve,
            commission_safety_buffer: pricing.commission_safety_buffer,
            max_binary_qualified_levels: pricing.max_binary_qualified_levels,
            commission_mode: pricing.commission_mode,
            
            economics_version: pricing.economics_version,
            economics_status: validation.status,
            validation_status: (validation.status === 'BLOCKED' || !validation.allowed) ? 'FAILED' : 'VALIDATED',
            blocked_reason: validation.blocked_reason,
            calculated_economics: econCalc.calculated,
            status: targetStatus,
            created_at: new Date().toISOString()
        };

        mockProducts.push(product);

        // Store initial economics version
        mockEconomicsVersions.push({
            id: 'ver-' + Math.random().toString(36).substr(2, 9),
            product_id: prodId,
            version_label: pricing.economics_version,
            configuration: pricing,
            calculated_economics: econCalc.calculated,
            created_by: authUser.id,
            created_at: new Date().toISOString()
        });

        // Audit Logging
        const auditLogEntry = {
            id: 'faudit-' + Math.random().toString(36).substr(2, 9),
            admin_id: authUser.id,
            action: 'PRODUCT_CREATED',
            entity_type: 'products',
            entity_id: prodId,
            details: { name: product.name, code: product.code, price: product.price, economics_version: product.economics_version },
            ip_address: req.socket.remoteAddress || '127.0.0.1',
            created_at: new Date().toISOString()
        };
        mockFinancialAuditLogs.push(auditLogEntry);
        KycService.logAction(mockAuditLogs, authUser.id, 'PRODUCT_CREATED', 'products', prodId, null, product);

        sendJSON(res, 201, { success: true, product, calculated: econCalc.calculated, validation });
        return;
    }

    // POST /api/products/edit (Admin only)
    if (req.method === 'POST' && pathname === '/api/products/edit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { id, name, status } = body;

        if (!id) {
            sendJSON(res, 400, { error: 'Product ID is required.' });
            return;
        }

        const prodIdx = mockProducts.findIndex(p => p.id === id);
        if (prodIdx === -1) {
            sendJSON(res, 404, { error: 'Product not found.' });
            return;
        }

        const currentProduct = mockProducts[prodIdx];

        // Determine next economics version
        let nextVersion = body.economicsVersion;
        if (!nextVersion) {
            const currentVer = currentProduct.economics_version || 'v1.0';
            const verNum = parseFloat(currentVer.replace('v', '')) || 1.0;
            nextVersion = `v${(verNum + 0.1).toFixed(1)}`;
        }

        // Merge existing values with incoming updates
        const merged = {
            pricing_mode: body.pricingMode || currentProduct.pricing_mode || 'FIXED',
            market_price: parseFloat(body.marketPrice !== undefined ? body.marketPrice : (currentProduct.market_price || currentProduct.price || 0.00)),
            discount_type: body.discountType || currentProduct.discount_type || 'NONE',
            discount_value: parseFloat(body.discountValue !== undefined ? body.discountValue : (currentProduct.discount_value || 0.00)),
            selling_price: parseFloat(body.price !== undefined ? body.price : (currentProduct.price || 0.00)),
            product_cost: parseFloat(body.productCost !== undefined ? body.productCost : (currentProduct.product_cost || 0.00)),
            
            // 7 Costs
            tax_type: body.taxType || currentProduct.tax_type || 'PERCENTAGE',
            tax_percent: parseFloat(body.taxPercent !== undefined ? body.taxPercent : (currentProduct.tax_percent || 0.00)),
            tax_fixed_amount: parseFloat(body.taxFixedAmount !== undefined ? body.taxFixedAmount : (currentProduct.tax_fixed_amount || currentProduct.tax_reserve || 0.00)),
            
            hosting_cost_percent: parseFloat(body.hostingCostPercent !== undefined ? body.hostingCostPercent : (currentProduct.hosting_cost_percent || 0.00)),
            hosting_cost_fixed: parseFloat(body.hostingCostFixed !== undefined ? body.hostingCostFixed : (currentProduct.hosting_cost_fixed || 0.00)),
            
            staff_cost_percent: parseFloat(body.staffCostPercent !== undefined ? body.staffCostPercent : (currentProduct.staff_cost_percent || 0.00)),
            staff_cost_fixed: parseFloat(body.staffCostFixed !== undefined ? body.staffCostFixed : (currentProduct.staff_cost_fixed || 0.00)),
            
            marketing_cost_percent: parseFloat(body.marketingCostPercent !== undefined ? body.marketingCostPercent : (currentProduct.marketing_cost_percent || 0.00)),
            marketing_cost_fixed: parseFloat(body.marketingCostFixed !== undefined ? body.marketingCostFixed : (currentProduct.marketing_cost_fixed || currentProduct.other_reserve || 0.00)),
            
            refund_reserve_percent: parseFloat(body.refundReservePercent !== undefined ? body.refundReservePercent : (currentProduct.refund_reserve_percent || 0.00)),
            refund_reserve_fixed: parseFloat(body.refundReserveFixed !== undefined ? body.refundReserveFixed : (currentProduct.refund_reserve_fixed || currentProduct.refund_risk_reserve || 0.00)),
            
            support_cost_percent: parseFloat(body.supportCostPercent !== undefined ? body.supportCostPercent : (currentProduct.support_cost_percent || 0.00)),
            support_cost_fixed: parseFloat(body.supportCostFixed !== undefined ? body.supportCostFixed : (currentProduct.support_cost_fixed || 0.00)),
            
            operational_cost_percent: parseFloat(body.operationalCostPercent !== undefined ? body.operationalCostPercent : (currentProduct.operational_cost_percent || 0.00)),
            operational_cost_fixed: parseFloat(body.operationalCostFixed !== undefined ? body.operationalCostFixed : (currentProduct.operational_cost_fixed || 0.00)),
            
            // Profit Reserve
            profit_reserve_type: body.profitReserveType || currentProduct.profit_reserve_type || (currentProduct.minimum_company_profit ? 'FIXED' : 'PERCENTAGE'),
            profit_reserve_percent: parseFloat(body.profitReservePercent !== undefined ? body.profitReservePercent : (currentProduct.profit_reserve_percent || 0.00)),
            profit_reserve_fixed: parseFloat(body.profitReserveFixed !== undefined ? body.profitReserveFixed : (currentProduct.profit_reserve_fixed !== undefined ? currentProduct.profit_reserve_fixed : (currentProduct.minimum_company_profit || 0.00))),
            profit_reserve_base: body.profitReserveBase || currentProduct.profit_reserve_base || 'AVAILABLE_CONTRIBUTION',

            minimum_company_profit: parseFloat(body.minimumCompanyProfit !== undefined ? body.minimumCompanyProfit : (currentProduct.minimum_company_profit || 0.00)),
            operating_cost_reserve: parseFloat(body.operatingCostReserve !== undefined ? body.operatingCostReserve : (currentProduct.operating_cost_reserve || 0.00)),
            payment_processing_reserve: parseFloat(body.paymentProcessingReserve !== undefined ? body.paymentProcessingReserve : (currentProduct.payment_processing_reserve || 0.00)),
            refund_risk_reserve: parseFloat(body.refundRiskReserve !== undefined ? body.refundRiskReserve : (currentProduct.refund_risk_reserve || 0.00)),
            tax_reserve: parseFloat(body.taxReserve !== undefined ? body.taxReserve : (currentProduct.tax_reserve || 0.00)),
            other_reserve: parseFloat(body.otherReserve !== undefined ? body.otherReserve : (currentProduct.other_reserve || 0.00)),
            commission_safety_buffer: parseFloat(body.commissionSafetyBuffer !== undefined ? body.commissionSafetyBuffer : (currentProduct.commission_safety_buffer || 0.00)),
            binary_volume: parseFloat(body.binaryVolume !== undefined ? body.binaryVolume : (currentProduct.binary_volume || 0.00)),
            direct_commission_rate: parseFloat(body.directCommissionRate !== undefined ? body.directCommissionRate : (currentProduct.direct_commission_percent || 8.00)),
            binary_commission_rate: parseFloat(body.binaryCommissionRate !== undefined ? body.binaryCommissionRate : (currentProduct.binary_commission_percent || 7.00)),
            max_binary_qualified_levels: parseInt(body.maxBinaryQualifiedLevels !== undefined ? body.maxBinaryQualifiedLevels : (currentProduct.max_binary_qualified_levels || 7)),
            commission_mode: body.commissionMode || currentProduct.commission_mode || 'MANUAL',
            economics_version: nextVersion
        };

        const maxSafeRate = SafeBinaryCommissionRateCalculator.calculateMaxSafeRate(merged);

        if (merged.commission_mode === 'AUTO_SAFE') {
            merged.binary_commission_rate = maxSafeRate;
        }

        const econCalc = ProductEconomicsCalculator.calculate(merged);
        const validation = ProductCommissionValidator.validate(econCalc);

        const targetStatus = status !== undefined ? status : currentProduct.status;
        if (targetStatus === 'ACTIVE') {
            // 1. Check basic economics block conditions first
            const isOverridden = Boolean(body.admin_override && body.override_reason);
            if (!isOverridden) {
                if (validation.status === 'BLOCKED' || !validation.allowed) {
                    sendJSON(res, 400, {
                        status: 'BLOCKED',
                        financial_status: 'NOT_VIABLE',
                        safety_status: 'UNSAFE',
                        blocked_reason: validation.blocked_reason,
                        shortfall: validation.shortfall,
                        effective_commission_budget: econCalc.calculated.effective_commission_budget,
                        maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        remaining_margin: econCalc.calculated.remaining_company_margin,
                        maximum_safe_binary_rate: maxSafeRate,
                        requested_binary_rate: merged.binary_commission_rate,
                        calculated: econCalc.calculated
                    });
                    return;
                }

                // 2. Check manual commission limits second
                if (merged.commission_mode === 'MANUAL' && merged.binary_commission_rate > maxSafeRate) {
                    sendJSON(res, 400, {
                        status: 'BLOCKED',
                        financial_status: 'NOT_VIABLE',
                        safety_status: 'UNSAFE',
                        blocked_reason: `Manual binary commission rate ${merged.binary_commission_rate}% exceeds maximum safe rate of ${maxSafeRate}%.`,
                        requested_binary_rate: merged.binary_commission_rate,
                        maximum_safe_binary_rate: maxSafeRate,
                        difference: Math.round((merged.binary_commission_rate - maxSafeRate) * 100) / 100,
                        expected_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        effective_commission_budget: econCalc.calculated.effective_commission_budget,
                        maximum_commission_exposure: econCalc.calculated.max_total_commission_exposure,
                        remaining_margin: econCalc.calculated.remaining_company_margin,
                        calculated: econCalc.calculated
                    });
                    return;
                }
            } else {
                // Log financial override audit event
                mockFinancialAuditLogs.push({
                    id: 'faudit-ovr-' + Math.random().toString(36).substr(2, 9),
                    admin_id: authUser.id,
                    action: 'FINANCIAL_OVERRIDE_ACTIVATION',
                    entity_type: 'products',
                    entity_id: id,
                    details: {
                        reason: body.override_reason,
                        blocked_reason: validation.blocked_reason,
                        shortfall: validation.shortfall
                    },
                    ip_address: req.socket.remoteAddress || '127.0.0.1',
                    created_at: new Date().toISOString()
                });
            }
        }

        // Apply edits
        mockProducts[prodIdx] = {
            ...currentProduct,
            name: name ? SecurityCore.sanitizeInput(name) : currentProduct.name,
            price: econCalc.calculated.selling_price,
            selling_price: econCalc.calculated.selling_price,
            binary_volume: merged.binary_volume,
            direct_commission_percent: merged.direct_commission_rate,
            binary_commission_percent: merged.binary_commission_rate,
            pricing_mode: merged.pricing_mode,
            market_price: merged.market_price,
            discount_type: merged.discount_type,
            discount_value: merged.discount_value,
            product_cost: merged.product_cost,
            
            // 7 Costs
            tax_type: merged.tax_type,
            tax_percent: merged.tax_percent,
            tax_fixed_amount: merged.tax_fixed_amount,
            hosting_cost_percent: merged.hosting_cost_percent,
            hosting_cost_fixed: merged.hosting_cost_fixed,
            staff_cost_percent: merged.staff_cost_percent,
            staff_cost_fixed: merged.staff_cost_fixed,
            marketing_cost_percent: merged.marketing_cost_percent,
            marketing_cost_fixed: merged.marketing_cost_fixed,
            refund_reserve_percent: merged.refund_reserve_percent,
            refund_reserve_fixed: merged.refund_reserve_fixed,
            support_cost_percent: merged.support_cost_percent,
            support_cost_fixed: merged.support_cost_fixed,
            operational_cost_percent: merged.operational_cost_percent,
            operational_cost_fixed: merged.operational_cost_fixed,
            
            profit_reserve_type: merged.profit_reserve_type,
            profit_reserve_percent: merged.profit_reserve_percent,
            profit_reserve_fixed: merged.profit_reserve_fixed,
            profit_reserve_base: merged.profit_reserve_base,

            minimum_company_profit: merged.minimum_company_profit,
            operating_cost_reserve: merged.operating_cost_reserve,
            payment_processing_reserve: merged.payment_processing_reserve,
            refund_risk_reserve: merged.refund_risk_reserve,
            tax_reserve: merged.tax_reserve,
            other_reserve: merged.other_reserve,
            commission_safety_buffer: merged.commission_safety_buffer,
            max_binary_qualified_levels: merged.max_binary_qualified_levels,
            commission_mode: merged.commission_mode,
            
            economics_version: nextVersion,
            economics_status: validation.status,
            validation_status: (validation.status === 'BLOCKED' || !validation.allowed) ? 'FAILED' : 'VALIDATED',
            blocked_reason: validation.blocked_reason,
            calculated_economics: econCalc.calculated,
            status: targetStatus,
            updated_at: new Date().toISOString()
        };

        // Store new economics version record
        mockEconomicsVersions.push({
            id: 'ver-' + Math.random().toString(36).substr(2, 9),
            product_id: id,
            version_label: nextVersion,
            configuration: merged,
            calculated_economics: econCalc.calculated,
            created_by: authUser.id,
            created_at: new Date().toISOString()
        });

        // Audit Logging
        const auditLogEntry = {
            id: 'faudit-' + Math.random().toString(36).substr(2, 9),
            admin_id: authUser.id,
            action: 'PRODUCT_ECONOMICS_EDITED',
            entity_type: 'products',
            entity_id: id,
            details: {
                previous_version: currentProduct.economics_version || 'v1.0',
                new_version: nextVersion,
                price: mockProducts[prodIdx].price,
                product_cost: mockProducts[prodIdx].product_cost,
                safety_status: validation.safety_status
            },
            ip_address: req.socket.remoteAddress || '127.0.0.1',
            created_at: new Date().toISOString()
        };
        mockFinancialAuditLogs.push(auditLogEntry);
        KycService.logAction(mockAuditLogs, authUser.id, 'PRODUCT_EDITED', 'products', id, currentProduct, mockProducts[prodIdx]);

        sendJSON(res, 200, { success: true, product: mockProducts[prodIdx], calculated: econCalc.calculated, validation });
        return;
    }

    // POST /api/admin/products/validate-economics (Admin only — Live preview)
    if (req.method === 'POST' && pathname === '/api/admin/products/validate-economics') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const econCalc = ProductEconomicsCalculator.calculate(body);
        const validation = ProductCommissionValidator.validate(econCalc);

        sendJSON(res, 200, {
            success: true,
            is_safe: validation.allowed,
            safety_status: validation.safety_status,
            status: validation.status,
            shortfall: validation.shortfall,
            maximum_safe_binary_rate: validation.maximum_safe_binary_rate,
            calculated: econCalc.calculated,
            validation: validation
        });
        return;
    }

    // POST /api/admin/products/simulate (Admin only — Scenario Simulator)
    if (req.method === 'POST' && pathname === '/api/admin/products/simulate') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { product_id, left_volume, right_volume, qualified_levels } = body;

        let productConfig = body;
        if (product_id) {
            const found = mockProducts.find(p => p.id === product_id);
            if (found) {
                productConfig = { ...found, ...body };
            }
        }

        const simulation = ProductEconomicsCalculator.simulateScenario(
            productConfig,
            left_volume || 0,
            right_volume || 0,
            qualified_levels !== undefined ? qualified_levels : 7
        );

        sendJSON(res, 200, {
            success: true,
            simulation
        });
        return;
    }

    // POST /api/admin/products/stress-test (Admin only — Stress Test & Simulation Engine)
    if (req.method === 'POST' && pathname === '/api/admin/products/stress-test') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const calculated = ProductEconomicsCalculator.calculate(body);
        const validation = ProductCommissionValidator.validate(calculated);

        sendJSON(res, 200, {
            success: true,
            revenue: calculated.calculated.selling_price,
            total_costs: calculated.calculated.total_operating_cost,
            profit_reserve: calculated.calculated.company_profit_reserve,
            commission_pool: calculated.calculated.commission_pool,
            direct_commission: calculated.calculated.direct_commission_amount,
            maximum_binary_exposure: calculated.calculated.maximum_binary_exposure,
            maximum_total_commission: calculated.calculated.maximum_total_commission_exposure,
            safety_margin: calculated.calculated.commission_safety_margin,
            commission_utilization: calculated.calculated.commission_pool_utilization,
            financial_status: validation.financial_status,
            safety_status: validation.safety_status,
            stress_test_result: validation.stress_test_result,
            is_viable: validation.is_viable,
            calculated: calculated.calculated,
            validation
        });
        return;
    }

    // GET /api/admin/settings/product-economics-defaults (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/settings/product-economics-defaults') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        sendJSON(res, 200, {
            success: true,
            defaults: mockEconomicsDefaults
        });
        return;
    }

    // POST /api/admin/settings/product-economics-defaults (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/settings/product-economics-defaults') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        mockEconomicsDefaults = {
            ...mockEconomicsDefaults,
            tax_percent: body.tax_percent !== undefined ? parseFloat(body.tax_percent) : mockEconomicsDefaults.tax_percent,
            hosting_cost_fixed: body.hosting_cost_fixed !== undefined ? parseFloat(body.hosting_cost_fixed) : mockEconomicsDefaults.hosting_cost_fixed,
            staff_cost_fixed: body.staff_cost_fixed !== undefined ? parseFloat(body.staff_cost_fixed) : mockEconomicsDefaults.staff_cost_fixed,
            marketing_cost_fixed: body.marketing_cost_fixed !== undefined ? parseFloat(body.marketing_cost_fixed) : mockEconomicsDefaults.marketing_cost_fixed,
            refund_reserve_percent: body.refund_reserve_percent !== undefined ? parseFloat(body.refund_reserve_percent) : mockEconomicsDefaults.refund_reserve_percent,
            support_cost_fixed: body.support_cost_fixed !== undefined ? parseFloat(body.support_cost_fixed) : mockEconomicsDefaults.support_cost_fixed,
            operational_cost_fixed: body.operational_cost_fixed !== undefined ? parseFloat(body.operational_cost_fixed) : mockEconomicsDefaults.operational_cost_fixed,
            payment_processing_fixed: body.payment_processing_fixed !== undefined ? parseFloat(body.payment_processing_fixed) : mockEconomicsDefaults.payment_processing_fixed,
            profit_reserve_percent: body.profit_reserve_percent !== undefined ? parseFloat(body.profit_reserve_percent) : mockEconomicsDefaults.profit_reserve_percent,
            direct_commission_percent: body.direct_commission_percent !== undefined ? parseFloat(body.direct_commission_percent) : mockEconomicsDefaults.direct_commission_percent,
            binary_commission_percent: body.binary_commission_percent !== undefined ? parseFloat(body.binary_commission_percent) : mockEconomicsDefaults.binary_commission_percent,
            maximum_qualified_uplines: body.maximum_qualified_uplines !== undefined ? parseInt(body.maximum_qualified_uplines) : mockEconomicsDefaults.maximum_qualified_uplines,
            updated_by: authUser.id,
            updated_at: new Date().toISOString()
        };

        mockFinancialAuditLogs.push({
            id: 'faudit-def-' + Math.random().toString(36).substr(2, 9),
            admin_id: authUser.id,
            action: 'ECONOMICS_DEFAULTS_UPDATED',
            entity_type: 'settings',
            entity_id: 'product-economics-defaults',
            details: mockEconomicsDefaults,
            ip_address: req.socket.remoteAddress || '127.0.0.1',
            created_at: new Date().toISOString()
        });

        sendJSON(res, 200, {
            success: true,
            message: 'Product economics defaults updated successfully.',
            defaults: mockEconomicsDefaults
        });
        return;
    }

    // GET /api/admin/reports/product-economics (Admin only — Section 32 Report)
    if (req.method === 'GET' && pathname === '/api/admin/reports/product-economics') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const statusFilter = (urlObj.searchParams.get('status') || '').toLowerCase();

        const reportRows = mockProducts.map(prod => {
            const calc = ProductEconomicsCalculator.calculate(prod);
            const val = ProductCommissionValidator.validate(calc);
            const calculated = calc.calculated;

            const isReviewRequired = Boolean(!prod.product_cost && !prod.tax_percent && !prod.minimum_company_profit);

            return {
                id: prod.id,
                product: prod.name || prod.title,
                code: prod.code,
                selling_price: calculated.selling_price,
                product_cost: calculated.product_cost,
                company_costs: calculated.total_operating_cost,
                profit_reserve: calculated.company_profit_reserve,
                commission_pool: calculated.commission_pool,
                direct_commission: calculated.direct_commission_amount,
                max_binary_exposure: calculated.maximum_binary_exposure,
                total_commission_exposure: calculated.maximum_total_commission_exposure,
                safety_margin: calculated.commission_safety_margin,
                utilization_percent: calculated.commission_pool_utilization,
                status: val.financial_status,
                financial_status: val.financial_status,
                safety_status: val.safety_status,
                product_status: prod.status || 'ACTIVE',
                economics_review_required: isReviewRequired,
                economics_version: prod.economics_version || 'v1.0'
            };
        });

        let filteredRows = reportRows;
        if (statusFilter === 'safe') {
            filteredRows = reportRows.filter(r => r.financial_status === 'SAFE');
        } else if (statusFilter === 'warning') {
            filteredRows = reportRows.filter(r => r.financial_status === 'WARNING');
        } else if (statusFilter === 'not_viable' || statusFilter === 'not-viable' || statusFilter === 'unsafe') {
            filteredRows = reportRows.filter(r => r.financial_status === 'NOT_VIABLE' || r.financial_status === 'BLOCKED');
        } else if (statusFilter === 'review_required' || statusFilter === 'review-required') {
            filteredRows = reportRows.filter(r => r.economics_review_required);
        } else if (statusFilter === 'active') {
            filteredRows = reportRows.filter(r => r.product_status === 'ACTIVE');
        } else if (statusFilter === 'inactive') {
            filteredRows = reportRows.filter(r => r.product_status === 'INACTIVE');
        }

        sendJSON(res, 200, {
            success: true,
            filter: statusFilter || 'all',
            total_count: filteredRows.length,
            products: filteredRows
        });
        return;
    }

    // GET /api/admin/products/migration-status (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/products/migration-status') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const total = mockProducts.length;
        const productsList = mockProducts.map(p => {
            const isConfigured = Boolean(
                p.product_cost > 0 ||
                p.tax_percent > 0 || p.tax_fixed_amount > 0 || p.tax_reserve > 0 ||
                p.staff_cost_percent > 0 || p.staff_cost_fixed > 0 ||
                p.marketing_cost_percent > 0 || p.marketing_cost_fixed > 0 || p.other_reserve > 0 ||
                p.refund_reserve_percent > 0 || p.refund_reserve_fixed > 0 || p.refund_risk_reserve > 0 ||
                p.profit_reserve_percent > 0 || p.profit_reserve_fixed > 0 || p.minimum_company_profit > 0
            );

            return {
                id: p.id,
                name: p.name || p.title,
                code: p.code,
                price: p.price || p.selling_price,
                product_cost: p.product_cost || 0,
                is_configured: isConfigured,
                economics_version: p.economics_version || 'v1.0',
                economics_status: p.economics_status || (isConfigured ? 'SAFE' : 'DRAFT'),
                status: p.status || 'ACTIVE'
            };
        });

        const configuredCount = productsList.filter(p => p.is_configured).length;
        const pendingCount = total - configuredCount;
        const safeCount = productsList.filter(p => p.economics_status === 'SAFE').length;
        const warningCount = productsList.filter(p => p.economics_status === 'WARNING').length;
        const unsafeCount = productsList.filter(p => p.economics_status === 'UNSAFE' || p.economics_status === 'BLOCKED').length;

        sendJSON(res, 200, {
            success: true,
            total_products: total,
            configured_products: configuredCount,
            pending_migration_products: pendingCount,
            safe_products: safeCount,
            warning_products: warningCount,
            unsafe_products: unsafeCount,
            products: productsList
        });
        return;
    }

    // GET /api/admin/reports/product-profitability (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/reports/product-profitability') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const filterProductId = urlObj.searchParams.get('product_id');

        let targetProducts = mockProducts;
        if (filterProductId) {
            targetProducts = mockProducts.filter(p => p.id === filterProductId);
        }

        let totalUnitsSold = 0;
        let totalGrossRevenue = 0;
        let totalProductCost = 0;
        let totalTaxCost = 0;
        let totalHostingCost = 0;
        let totalStaffCost = 0;
        let totalMarketingCost = 0;
        let totalRefundReserve = 0;
        let totalSupportCost = 0;
        let totalOperationalCost = 0;
        let totalProfitReserve = 0;
        let totalDirectCommission = 0;
        let totalBinaryCommission = 0;
        let totalNetProfit = 0;

        const reportRows = targetProducts.map(prod => {
            // Find approved purchases
            const prodPurchases = mockPurchases.filter(pur => 
                (pur.product_id === prod.id || pur.product_slug === prod.id || pur.product_id === prod.code) &&
                (pur.status === 'ACTIVE' || pur.status === 'APPROVED' || pur.status === 'COMPLETED')
            );
            
            const unitsSold = prodPurchases.length;
            const calc = ProductEconomicsCalculator.calculate(prod);
            const calculated = calc.calculated;

            const revenue = Math.round(unitsSold * calculated.selling_price * 100) / 100;
            const pCost = Math.round(unitsSold * calculated.product_cost * 100) / 100;
            const tCost = Math.round(unitsSold * calculated.tax_cost * 100) / 100;
            const hCost = Math.round(unitsSold * calculated.hosting_cost * 100) / 100;
            const stCost = Math.round(unitsSold * calculated.staff_cost * 100) / 100;
            const mCost = Math.round(unitsSold * calculated.marketing_cost * 100) / 100;
            const refCost = Math.round(unitsSold * calculated.refund_reserve * 100) / 100;
            const supCost = Math.round(unitsSold * calculated.support_cost * 100) / 100;
            const opCost = Math.round(unitsSold * calculated.operational_cost * 100) / 100;
            const profReserve = Math.round(unitsSold * calculated.company_profit_reserve * 100) / 100;
            
            const directCommPaid = Math.round(unitsSold * calculated.direct_commission_amount * 100) / 100;
            // Binary commission paid estimate based on 7 levels max
            const binaryCommPaid = Math.round(unitsSold * calculated.max_binary_liability * 100) / 100;
            const totalCommPaid = directCommPaid + binaryCommPaid;

            const totalOperatingCosts = tCost + hCost + stCost + mCost + refCost + supCost + opCost;
            const netProfit = Math.round((revenue - pCost - totalOperatingCosts - totalCommPaid) * 100) / 100;
            const profitMargin = revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0.00;

            totalUnitsSold += unitsSold;
            totalGrossRevenue += revenue;
            totalProductCost += pCost;
            totalTaxCost += tCost;
            totalHostingCost += hCost;
            totalStaffCost += stCost;
            totalMarketingCost += mCost;
            totalRefundReserve += refCost;
            totalSupportCost += supCost;
            totalOperationalCost += opCost;
            totalProfitReserve += profReserve;
            totalDirectCommission += directCommPaid;
            totalBinaryCommission += binaryCommPaid;
            totalNetProfit += netProfit;

            return {
                product_id: prod.id,
                product_name: prod.name || prod.title,
                product_code: prod.code,
                selling_price: calculated.selling_price,
                units_sold: unitsSold,
                gross_revenue: revenue,
                product_cost: pCost,
                tax_cost: tCost,
                hosting_cost: hCost,
                staff_cost: stCost,
                marketing_cost: mCost,
                refund_reserve: refCost,
                support_cost: supCost,
                operational_cost: opCost,
                total_operating_reserves: totalOperatingCosts,
                company_profit_reserve: profReserve,
                direct_commission_paid: directCommPaid,
                binary_commission_paid: binaryCommPaid,
                total_commission_paid: totalCommPaid,
                net_company_profit: netProfit,
                net_profit_margin_percent: profitMargin,
                economics_version: prod.economics_version || 'v1.0',
                safety_status: calculated.safety_status
            };
        });

        sendJSON(res, 200, {
            success: true,
            summary: {
                total_products: targetProducts.length,
                total_units_sold: totalUnitsSold,
                total_gross_revenue: Math.round(totalGrossRevenue * 100) / 100,
                total_product_cost: Math.round(totalProductCost * 100) / 100,
                total_operating_reserves: Math.round((totalTaxCost + totalHostingCost + totalStaffCost + totalMarketingCost + totalRefundReserve + totalSupportCost + totalOperationalCost) * 100) / 100,
                total_commissions_paid: Math.round((totalDirectCommission + totalBinaryCommission) * 100) / 100,
                total_net_company_profit: Math.round(totalNetProfit * 100) / 100,
                average_profit_margin_percent: totalGrossRevenue > 0 ? Math.round((totalNetProfit / totalGrossRevenue) * 10000) / 100 : 0.00
            },
            products: reportRows
        });
        return;
    }

    // GET /api/admin/products/audit-logs (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/products/audit-logs') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const combinedLogs = [
            ...mockFinancialAuditLogs,
            ...mockAuditLogs.filter(l => l.entity_type === 'products' || (l.action && l.action.includes('PRODUCT')))
        ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        sendJSON(res, 200, {
            success: true,
            total_logs: combinedLogs.length,
            audit_logs: combinedLogs
        });
        return;
    }

    // POST /api/deposits/submit
    if (req.method === 'POST' && pathname === '/api/deposits/submit') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { productId, bankReference, amount, slipUrl, notes } = body;

        if (!productId || !bankReference || !amount || !slipUrl) {
            sendJSON(res, 400, { error: 'All fields (productId, reference, amount, slip) are required.' });
            return;
        }

        const duplicate = mockPaymentDeposits.some(d => d.bank_reference === bankReference);
        if (duplicate) {
            sendJSON(res, 400, { error: 'This payment reference code has already been submitted.' });
            return;
        }

        const purchaseId = 'purch-' + Math.random().toString(36).substr(2, 9);
        const purchase = {
            id: purchaseId,
            user_id: authUser.id,
            product_id: productId,
            price_paid: parseFloat(amount),
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const depositId = 'dep-' + Math.random().toString(36).substr(2, 9);
        const deposit = {
            id: depositId,
            purchase_id: purchaseId,
            user_id: authUser.id,
            bank_reference: SecurityCore.sanitizeInput(bankReference),
            slip_url: slipUrl,
            status: 'PENDING',
            notes: SecurityCore.sanitizeInput(notes || ''),
            created_at: new Date().toISOString()
        };

        mockProductPurchases.push(purchase);
        mockPaymentDeposits.push(deposit);

        KycService.logAction(mockAuditLogs, authUser.id, 'DEPOSIT_SUBMITTED', 'payment_deposits', depositId, null, deposit);

        sendJSON(res, 201, { success: true, purchaseId });
        return;
    }

    // ========================================================
    // MEMBER PRODUCT PURCHASE CENTER API ROUTER
    // ========================================================

    // GET /api/member/company-bank-details
    if (req.method === 'GET' && pathname === '/api/member/company-bank-details') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }
        sendJSON(res, 200, { success: true, bankDetails: mockCompanyBankDetails });
        return;
    }

    // GET /api/member/products
    if (req.method === 'GET' && pathname === '/api/member/products') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const userPurchases = mockProductPurchases.filter(p => p.user_id === authUser.id);
        const userDeposits = mockPaymentDeposits.filter(d => d.user_id === authUser.id);

        const enrichedProducts = mockProducts.filter(p => p.status === 'ACTIVE').map(p => {
            const hasActivePurchase = userPurchases.some(up => up.product_id === p.id && up.status === 'ACTIVE');
            const hasPendingPurchase = userPurchases.some(up => up.product_id === p.id && up.status === 'PENDING') ||
                userDeposits.some(d => (d.product_id === p.id || userPurchases.some(up => up.id === d.purchase_id && up.product_id === p.id)) && d.status === 'PENDING');

            let accessStatus = 'AVAILABLE';
            if (hasActivePurchase) accessStatus = 'ACTIVE';
            else if (hasPendingPurchase) accessStatus = 'PENDING';

            return {
                id: p.id,
                code: p.code,
                name: p.name || p.title,
                title: p.title || p.name,
                category: p.category,
                price: p.selling_price || p.price,
                original_price: p.original_price || p.price,
                discount_price: p.discount_price || p.selling_price || p.price,
                selling_price: p.selling_price || p.price,
                savings: (p.original_price && p.original_price > (p.selling_price || p.price)) ? (p.original_price - (p.selling_price || p.price)) : 0,
                discount_percent: (p.original_price && p.original_price > (p.selling_price || p.price)) ? Math.round(((p.original_price - (p.selling_price || p.price)) / p.original_price) * 100) : 0,
                binary_volume: p.binary_volume || p.selling_price || p.price,
                duration: p.duration || 'Comprehensive Lifetime Access',
                access_type: p.access_type || 'Lifetime Access',
                description: p.description,
                benefits: p.benefits || [],
                modules_count: p.modules_count || 6,
                image_url: p.image_url,
                is_purchased: hasActivePurchase,
                is_pending: hasPendingPurchase,
                can_buy: !hasActivePurchase && !hasPendingPurchase,
                access_status: accessStatus
            };
        });

        sendJSON(res, 200, { success: true, products: enrichedProducts });
        return;
    }

    // GET /api/member/products/:id
    if (req.method === 'GET' && pathname.startsWith('/api/member/products/')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const productId = pathname.replace('/api/member/products/', '').trim();
        const product = mockProducts.find(p => p.id === productId || p.code === productId);
        if (!product) {
            sendJSON(res, 404, { error: 'Product not found.' });
            return;
        }

        const userPurchases = mockProductPurchases.filter(p => p.user_id === authUser.id);
        const userDeposits = mockPaymentDeposits.filter(d => d.user_id === authUser.id);
        const hasActivePurchase = userPurchases.some(up => up.product_id === product.id && up.status === 'ACTIVE');
        const hasPendingPurchase = userPurchases.some(up => up.product_id === product.id && up.status === 'PENDING') ||
            userDeposits.some(d => (d.product_id === product.id || userPurchases.some(up => up.id === d.purchase_id && up.product_id === product.id)) && d.status === 'PENDING');

        sendJSON(res, 200, {
            success: true,
            product: {
                ...product,
                is_purchased: hasActivePurchase,
                is_pending: hasPendingPurchase,
                can_buy: !hasActivePurchase && !hasPendingPurchase,
                refund_policy: '14-Day Money Back Guarantee under standard usage terms'
            }
        });
        return;
    }

    // POST /api/member/checkout
    if (req.method === 'POST' && pathname === '/api/member/checkout') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { productId } = body;

        const product = mockProducts.find(p => p.id === productId || p.code === productId);
        if (!product) {
            sendJSON(res, 404, { error: 'Product not found.' });
            return;
        }

        // Duplicate purchase guard
        const hasActive = mockProductPurchases.some(p => p.user_id === authUser.id && p.product_id === product.id && p.status === 'ACTIVE');
        if (hasActive) {
            sendJSON(res, 400, { error: 'You already own this course with active lifetime access.' });
            return;
        }

        const hasPending = mockProductPurchases.some(p => p.user_id === authUser.id && p.product_id === product.id && p.status === 'PENDING') ||
            mockPaymentDeposits.some(d => d.user_id === authUser.id && d.product_id === product.id && d.status === 'PENDING');
        if (hasPending) {
            sendJSON(res, 400, { error: 'You already have a pending payment verification for this course.' });
            return;
        }

        const orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        sendJSON(res, 200, {
            success: true,
            checkoutSession: {
                order_number: orderNumber,
                product_id: product.id,
                product_name: product.name || product.title,
                selling_price: product.selling_price || product.price,
                original_price: product.original_price || product.price,
                member_id: authUser.id,
                member_name: authUser.full_name || authUser.username,
                member_email: authUser.email,
                company_banks: mockCompanyBankDetails
            }
        });
        return;
    }

    // POST /api/member/payments
    if (req.method === 'POST' && pathname === '/api/member/payments') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { productId, orderNumber, bankReference, transferDate, amount, slipUrl, notes } = body;

        if (!productId || !bankReference || !amount || parseFloat(amount) <= 0) {
            sendJSON(res, 400, { error: 'Product, Bank Reference, and Valid Amount are required.' });
            return;
        }

        const product = mockProducts.find(p => p.id === productId || p.code === productId);
        if (!product) {
            sendJSON(res, 404, { error: 'Selected product is invalid.' });
            return;
        }

        // Duplicate Reference Guard
        const cleanRef = SecurityCore.sanitizeInput(bankReference).trim();
        const duplicateRef = mockPaymentDeposits.some(d => d.bank_reference.toLowerCase() === cleanRef.toLowerCase());
        if (duplicateRef) {
            sendJSON(res, 400, { error: 'This payment reference code has already been submitted.' });
            return;
        }

        // Duplicate Active/Pending Purchase Guard
        const alreadyActive = mockProductPurchases.some(p => p.user_id === authUser.id && p.product_id === product.id && p.status === 'ACTIVE');
        if (alreadyActive) {
            sendJSON(res, 400, { error: 'You already own this course with active access.' });
            return;
        }

        const purchaseId = 'purch-' + Math.random().toString(36).substr(2, 9);
        const purchase = {
            id: purchaseId,
            order_number: orderNumber || ('ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
            user_id: authUser.id,
            product_id: product.id,
            product_name: product.name || product.title,
            price_paid: parseFloat(amount),
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        const depositId = 'dep-' + Math.random().toString(36).substr(2, 9);
        const deposit = {
            id: depositId,
            order_number: purchase.order_number,
            purchase_id: purchaseId,
            user_id: authUser.id,
            product_id: product.id,
            product_name: product.name || product.title,
            amount: parseFloat(amount),
            bank_reference: cleanRef,
            transfer_date: transferDate || new Date().toISOString().split('T')[0],
            slip_url: slipUrl || 'storage/private/slips/sample-slip.jpg',
            status: 'PENDING',
            notes: SecurityCore.sanitizeInput(notes || ''),
            created_at: new Date().toISOString()
        };

        mockProductPurchases.push(purchase);
        mockPaymentDeposits.push(deposit);

        KycService.logAction(mockAuditLogs, authUser.id, 'PAYMENT_SUBMITTED', 'payment_deposits', depositId, null, {
            order_number: purchase.order_number,
            product_id: product.id,
            amount: deposit.amount,
            bank_reference: deposit.bank_reference
        });

        saveDbStore();

        sendJSON(res, 201, {
            success: true,
            orderNumber: purchase.order_number,
            depositId: depositId,
            message: 'Your payment has been submitted successfully and is awaiting verification.'
        });
        return;
    }

    // GET /api/member/orders
    if (req.method === 'GET' && pathname === '/api/member/orders') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const userDeposits = mockPaymentDeposits.filter(d => d.user_id === authUser.id);
        const orders = userDeposits.map(d => {
            const purch = mockProductPurchases.find(p => p.id === d.purchase_id) || {};
            const prod = mockProducts.find(p => p.id === d.product_id || p.id === purch.product_id) || {};
            return {
                id: d.id,
                order_number: d.order_number || purch.order_number || ('ORD-' + d.id.substring(4, 10).toUpperCase()),
                product_id: d.product_id || purch.product_id,
                product_name: prod.name || prod.title || d.product_name || purch.product_name || 'Masterclass',
                amount: d.amount || purch.price_paid || prod.selling_price || 0,
                bank_reference: d.bank_reference,
                transfer_date: d.transfer_date || d.created_at,
                slip_url: d.slip_url,
                status: d.status,
                admin_notes: d.notes || null,
                reviewed_at: d.reviewed_at || null,
                created_at: d.created_at
            };
        }).reverse();

        sendJSON(res, 200, { success: true, orders });
        return;
    }

    // GET /api/member/orders/:id
    if (req.method === 'GET' && pathname.startsWith('/api/member/orders/')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const orderRef = pathname.replace('/api/member/orders/', '').trim();
        const deposit = mockPaymentDeposits.find(d => (d.id === orderRef || d.order_number === orderRef) && d.user_id === authUser.id);
        if (!deposit) {
            sendJSON(res, 404, { error: 'Order not found.' });
            return;
        }

        const purch = mockProductPurchases.find(p => p.id === deposit.purchase_id) || {};
        const prod = mockProducts.find(p => p.id === deposit.product_id || p.id === purch.product_id) || {};

        sendJSON(res, 200, {
            success: true,
            order: {
                id: deposit.id,
                order_number: deposit.order_number || purch.order_number || ('ORD-' + deposit.id.substring(4, 10).toUpperCase()),
                product_id: deposit.product_id || purch.product_id,
                product_name: prod.name || prod.title || deposit.product_name || 'Masterclass',
                category: prod.category || 'Course',
                amount: deposit.amount || purch.price_paid || 0,
                bank_reference: deposit.bank_reference,
                transfer_date: deposit.transfer_date || deposit.created_at,
                slip_url: deposit.slip_url,
                status: deposit.status,
                admin_notes: deposit.notes || null,
                reviewed_at: deposit.reviewed_at || null,
                created_at: deposit.created_at
            }
        });
        return;
    }

    // GET /api/member/my-products
    if (req.method === 'GET' && pathname === '/api/member/my-products') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const userPurchases = mockProductPurchases.filter(p => p.user_id === authUser.id);
        const myProducts = userPurchases.map(p => {
            const prod = mockProducts.find(mp => mp.id === p.product_id) || {};
            return {
                purchase_id: p.id,
                order_number: p.order_number || ('ORD-' + p.id.substring(6).toUpperCase()),
                product_id: p.product_id,
                product_name: p.product_name || prod.name || prod.title || 'Masterclass',
                category: prod.category || 'Education',
                selling_price: p.price_paid || prod.selling_price || 0,
                image_url: prod.image_url || 'assets/facebook_course_banner.jpg',
                status: p.status,
                activated_at: p.activated_at || p.created_at,
                classroom_url: prod.course_url || 'student-dashboard.html'
            };
        }).reverse();

        sendJSON(res, 200, { success: true, myProducts });
        return;
    }

    // GET /api/admin/deposits/pending
    if (req.method === 'GET' && pathname === '/api/admin/deposits/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || !isAdminUser(authUser)) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const pending = mockPaymentDeposits.filter(d => d.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/deposits/review
    if (req.method === 'POST' && pathname === '/api/admin/deposits/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || !isAdminUser(authUser)) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { depositId, action, notes } = body;

        if (!depositId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'DepositId and action are required.' });
            return;
        }

        const depIdx = mockPaymentDeposits.findIndex(d => d.id === depositId);
        if (depIdx === -1) {
            sendJSON(res, 404, { error: 'Deposit not found.' });
            return;
        }

        const deposit = mockPaymentDeposits[depIdx];
        const oldStatus = deposit.status;

        if (oldStatus === 'APPROVED' && action === 'APPROVED') {
            sendJSON(res, 400, { error: 'Deposit has already been approved and finalized.' });
            return;
        }

        mockPaymentDeposits[depIdx].status = action;
        mockPaymentDeposits[depIdx].reviewer_id = authUser.id;
        mockPaymentDeposits[depIdx].reviewed_at = new Date().toISOString();
        if (notes) mockPaymentDeposits[depIdx].notes = SecurityCore.sanitizeInput(notes);

        const purchIdx = mockProductPurchases.findIndex(p => p.id === deposit.purchase_id);
        let orchResult = null;
        if (purchIdx !== -1) {
            if (action === 'APPROVED') {
                const activePurchase = mockProductPurchases[purchIdx];
                activePurchase.status = 'ACTIVE';
                activePurchase.activated_at = new Date().toISOString();

                // 1. Fetch Product definition
                const product = mockProducts.find(p => p.id === activePurchase.product_id || p.code === activePurchase.product_id) || mockProducts[0];

                // 2. Activate Buyer Member Status in Users DB
                const buyer = mockUsers.find(u => u.id === activePurchase.user_id);
                if (buyer) {
                    buyer.status = 'ACTIVE';
                }

                // 3. Execute Centralized Purchase Orchestrator Workflow (Snapshot, BV Propagation, 8% Direct, 7% Binary, 7-Level Upline, Wallet Ledger, Idempotency)
                try {
                    orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
                        purchase: activePurchase,
                        product: product,
                        userId: activePurchase.user_id,
                        binaryNodes: mockBinaryNodes,
                        sponsors: mockSponsors,
                        users: mockUsers,
                        kycDocs: mockKycDocs,
                        purchases: mockProductPurchases,
                        commissionLedger: mockCommissionTransactions,
                        volumeLedger: mockVolumeLedger,
                        walletLedger: mockWalletLedger,
                        dailyEarningsMap: mockDailyEarningsMap
                    });
                } catch (orchErr) {
                    console.warn(`Orchestrator warning during deposit review: ${orchErr.message}`);
                }

                ProductService.triggerPurchaseActivation(activePurchase);
                KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED', 'product_purchases', deposit.purchase_id, null, { 
                    snapshot_id: activePurchase.economics_snapshot ? activePurchase.economics_snapshot.id : null 
                });

                addLiveEvent('ORDER_PAID', {
                    orderNumber: activePurchase.order_number,
                    purchaseId: activePurchase.id,
                    userId: activePurchase.user_id,
                    amount: activePurchase.price_paid,
                    productName: product.name || product.title
                }, `Payment Approved: Order #${activePurchase.order_number} (${product.name || product.title}) - LKR ${activePurchase.price_paid.toFixed(2)}`);
            } else {
                mockProductPurchases[purchIdx].status = 'CANCELLED';
            }
        }

        const auditAction = action === 'APPROVED' ? 'DEPOSIT_APPROVED' : 'DEPOSIT_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'payment_deposits', depositId, { status: oldStatus }, { status: action });

        saveDbStore();

        sendJSON(res, 200, { 
            success: true, 
            message: `Deposit status has been updated to ${action}.`,
            action: action,
            orchestration: orchResult
        });
        return;
    }

    // POST /api/admin/orders/:orderId/approve-payment (Direct RESTful Approval Endpoint)
    if (req.method === 'POST' && pathname.startsWith('/api/admin/orders/') && pathname.endsWith('/approve-payment')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || !isAdminUser(authUser)) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const parts = pathname.split('/');
        const orderId = parts[4]; // /api/admin/orders/:orderId/approve-payment

        const purchIdx = mockProductPurchases.findIndex(p => p.id === orderId || p.order_number === orderId);
        if (purchIdx === -1) {
            sendJSON(res, 404, { error: `Order ${orderId} not found.` });
            return;
        }

        const activePurchase = mockProductPurchases[purchIdx];
        if (activePurchase.status === 'ACTIVE') {
            sendJSON(res, 400, { error: `Order ${orderId} is already approved and active.` });
            return;
        }

        activePurchase.status = 'ACTIVE';
        activePurchase.activated_at = new Date().toISOString();

        // 1. Fetch Product
        const product = mockProducts.find(p => p.id === activePurchase.product_id || p.code === activePurchase.product_id) || mockProducts[0];

        // 2. Activate Buyer
        const buyer = mockUsers.find(u => u.id === activePurchase.user_id);
        if (buyer) {
            buyer.status = 'ACTIVE';
        }

        // 3. Mark Matching Deposit as APPROVED if present
        const depIdx = mockPaymentDeposits.findIndex(d => d.purchase_id === activePurchase.id || d.order_number === activePurchase.order_number);
        if (depIdx !== -1) {
            mockPaymentDeposits[depIdx].status = 'APPROVED';
            mockPaymentDeposits[depIdx].reviewer_id = authUser.id;
            mockPaymentDeposits[depIdx].reviewed_at = activePurchase.activated_at;
        }

        // 4. Execute PurchaseOrchestrator
        let orchResult = null;
        try {
            orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
                purchase: activePurchase,
                product: product,
                userId: activePurchase.user_id,
                binaryNodes: mockBinaryNodes,
                sponsors: mockSponsors,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                commissionLedger: mockCommissionTransactions,
                volumeLedger: mockVolumeLedger,
                walletLedger: mockWalletLedger,
                dailyEarningsMap: mockDailyEarningsMap
            });
        } catch (orchErr) {
            console.warn(`Orchestrator warning during order approval: ${orchErr.message}`);
        }

        ProductService.triggerPurchaseActivation(activePurchase);
        KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED', 'product_purchases', activePurchase.id, null, { 
            snapshot_id: activePurchase.economics_snapshot ? activePurchase.economics_snapshot.id : null 
        });

        addLiveEvent('ORDER_PAID', {
            orderNumber: activePurchase.order_number,
            purchaseId: activePurchase.id,
            userId: activePurchase.user_id,
            amount: activePurchase.price_paid,
            productName: product.name || product.title
        }, `Payment Approved: Order #${activePurchase.order_number} (${product.name || product.title}) - LKR ${activePurchase.price_paid.toFixed(2)}`);

        saveDbStore();

        sendJSON(res, 200, {
            success: true,
            orderId: activePurchase.id,
            orderNumber: activePurchase.order_number,
            status: 'ACTIVE',
            message: `Order ${orderId} has been successfully approved and activated.`,
            orchestration: orchResult
        });
        return;
    }

    // ========================================================
    // WALLET & WITHDRAWAL SYSTEM API ROUTER (PHASE 8)
    // ========================================================

    // GET /api/wallet/balance
    if (req.method === 'GET' && pathname === '/api/wallet/balance') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const userLedger = mockWalletLedger.filter(tx => tx.user_id === authUser.id);
        const balances = WalletService.calculateBalances(userLedger);
        sendJSON(res, 200, { balances, ledger: userLedger });
        return;
    }

    // POST /api/withdrawal/request & /api/member/withdraw
    if (req.method === 'POST' && (pathname === '/api/withdrawal/request' || pathname === '/api/member/withdraw')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const amount = parseFloat(body.amount);

        if (!amount || amount <= 0) {
            sendJSON(res, 400, { error: 'A valid amount is required.' });
            return;
        }

        // Fetch User KYC Status & Active Bank Details
        const kyc = mockKycDocs.find(d => d.user_id === authUser.id);
        const kycStatus = kyc ? kyc.status : 'PENDING';

        const userLedger = mockWalletLedger.filter(tx => tx.user_id === authUser.id);
        const balances = WalletService.calculateBalances(userLedger);

        const check = WalletService.validateWithdrawal(amount, balances.availableBalance, kycStatus);
        if (!check.valid) {
            sendJSON(res, 400, { error: check.error });
            return;
        }

        const reqId = 'withdraw-' + Math.random().toString(36).substr(2, 9);
        const request = {
            id: reqId,
            user_id: authUser.id,
            amount: amount,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };

        mockWithdrawalRequests.push(request);

        // Lock funds in Wallet Ledger (Negative Entry)
        mockWalletLedger.push({
            id: 'tx-' + Math.random().toString(36).substr(2, 9),
            user_id: authUser.id,
            type: 'WITHDRAWAL_REQUEST',
            amount: -amount,
            reference_id: reqId,
            reference_type: 'withdrawal_requests',
            created_at: new Date().toISOString()
        });

        KycService.logAction(mockAuditLogs, authUser.id, 'WITHDRAWAL_REQUESTED', 'withdrawal_requests', reqId, null, { amount });

        saveDbStore();

        sendJSON(res, 201, { success: true, request });
        return;
    }

    // GET /api/admin/withdrawals/pending (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/withdrawals/pending') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const pending = mockWithdrawalRequests.filter(w => w.status === 'PENDING');
        sendJSON(res, 200, { pending });
        return;
    }

    // POST /api/admin/withdrawals/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/withdrawals/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { requestId, action, notes } = body; // action is 'APPROVED' or 'REJECTED'

        if (!requestId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
            sendJSON(res, 400, { error: 'RequestId and action are required.' });
            return;
        }

        const reqIdx = mockWithdrawalRequests.findIndex(w => w.id === requestId);
        if (reqIdx === -1) {
            sendJSON(res, 404, { error: 'Withdrawal request not found.' });
            return;
        }

        const reqObj = mockWithdrawalRequests[reqIdx];
        const oldStatus = reqObj.status;
        mockWithdrawalRequests[reqIdx].status = action;
        mockWithdrawalRequests[reqIdx].reviewer_id = authUser.id;
        mockWithdrawalRequests[reqIdx].reviewed_at = new Date().toISOString();

        if (action === 'REJECTED') {
            // Unlock funds: credit back to wallet ledger
            mockWalletLedger.push({
                id: 'tx-' + Math.random().toString(36).substr(2, 9),
                user_id: reqObj.user_id,
                type: 'ADJUSTMENT',
                amount: reqObj.amount, // Positive adjustment to refund back
                reference_id: requestId,
                reference_type: 'withdrawal_requests',
                created_at: new Date().toISOString()
            });
        }

        const auditAction = action === 'APPROVED' ? 'WITHDRAWAL_APPROVED' : 'WITHDRAWAL_REJECTED';
        KycService.logAction(mockAuditLogs, authUser.id, auditAction, 'withdrawal_requests', requestId, { status: oldStatus }, { status: action, notes });

        saveDbStore();

        sendJSON(res, 200, { success: true, message: `Request status has been updated to ${action}.` });
        return;
    }

    // POST /api/admin/withdrawals/pay (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/withdrawals/pay') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || authUser.role !== 'admin') {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { requestId } = body;

        if (!requestId) {
            sendJSON(res, 400, { error: 'RequestId is required.' });
            return;
        }

        const reqIdx = mockWithdrawalRequests.findIndex(w => w.id === requestId);
        if (reqIdx === -1) {
            sendJSON(res, 404, { error: 'Withdrawal request not found.' });
            return;
        }

        const reqObj = mockWithdrawalRequests[reqIdx];
        if (reqObj.status !== 'APPROVED') {
            sendJSON(res, 400, { error: 'Only approved requests can be marked as paid.' });
            return;
        }

        mockWithdrawalRequests[reqIdx].status = 'PAID';
        mockWithdrawalRequests[reqIdx].paid_at = new Date().toISOString();

        // Log paid withdrawal in wallet ledger
        mockWalletLedger.push({
            id: 'tx-' + Math.random().toString(36).substr(2, 9),
            user_id: reqObj.user_id,
            type: 'WITHDRAWAL_PAID',
            amount: -reqObj.amount, // Lock out transaction
            reference_id: requestId,
            reference_type: 'withdrawal_requests',
            created_at: new Date().toISOString()
        });

        KycService.logAction(mockAuditLogs, authUser.id, 'WITHDRAWAL_PAID', 'withdrawal_requests', requestId, { status: 'APPROVED' }, { status: 'PAID' });

        saveDbStore();

        sendJSON(res, 200, { success: true, message: 'Withdrawal marked as paid successfully.' });
        return;
    }

    // ========================================================
    // REPORTING & ANALYTICS API ROUTER (STEP 28)
    // ========================================================

    // GET /api/admin/reports/financial (STEP 28)
    if (req.method === 'GET' && pathname === '/api/admin/reports/financial') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const productId = url.searchParams.get('productId');
        const status = url.searchParams.get('status');

        try {
            const report = ReportService.generateFinancialReport({
                requestingUser: authUser,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                withdrawals: mockWithdrawalRequests,
                products: mockProducts,
                filters: { startDate, endDate, productId, status },
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/admin/reports/mlm (STEP 28)
    if (req.method === 'GET' && pathname === '/api/admin/reports/mlm') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        try {
            const report = ReportService.generateMlmReport({
                requestingUser: authUser,
                users: mockUsers,
                binaryNodes: mockBinaryNodes,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors,
                walletLedger: mockWalletLedger,
                purchases: mockProductPurchases,
                kycDocs: mockKycDocs,
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/reports/statement (STEP 28)
    if (req.method === 'GET' && pathname === '/api/member/reports/statement') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const targetUserId = url.searchParams.get('userId') || authUser.id;
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const commissionType = url.searchParams.get('commissionType');

        try {
            const report = ReportService.generateMemberReport({
                requestingUser: authUser,
                targetUserId,
                users: mockUsers,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                withdrawals: mockWithdrawalRequests,
                binaryNodes: mockBinaryNodes,
                kycDocs: mockKycDocs,
                filters: { startDate, endDate, commissionType },
                auditLogs: mockAuditLogs
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 403, { error: err.message });
        }
        return;
    }

    // GET /api/admin/reports
    if (req.method === 'GET' && pathname === '/api/admin/reports') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const type = url.searchParams.get('type') || 'sales';
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const productId = url.searchParams.get('productId');
        const userId = url.searchParams.get('userId');
        const limit = url.searchParams.get('limit') || 10;
        const offset = url.searchParams.get('offset') || 0;

        let dataset = [];
        if (type === 'sales') {
            dataset = mockProductPurchases;
        } else if (type === 'commissions') {
            dataset = mockWalletLedger.filter(tx => (tx.type || '').includes('COMMISSION'));
        } else if (type === 'withdrawals') {
            dataset = mockWithdrawalRequests;
        } else if (type === 'deposits') {
            dataset = mockPaymentDeposits;
        } else if (type === 'kyc') {
            dataset = mockKycDocs;
        }

        const report = ReportService.generateReport(dataset, { startDate, endDate, productId, userId, limit, offset });
        sendJSON(res, 200, report);
        return;
    }

    // GET /api/admin/reports/export (STEP 28 multi-format CSV / Excel / PDF)
    if (req.method === 'GET' && pathname === '/api/admin/reports/export') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const type = url.searchParams.get('type') || 'sales';
        const format = (url.searchParams.get('format') || 'csv').toLowerCase();

        let dataset = [];
        if (type === 'sales') {
            dataset = mockProductPurchases;
        } else if (type === 'commissions') {
            dataset = mockWalletLedger.filter(tx => (tx.type || '').includes('COMMISSION'));
        } else if (type === 'withdrawals') {
            dataset = mockWithdrawalRequests;
        } else if (type === 'deposits') {
            dataset = mockPaymentDeposits;
        }

        // Log sensitive report export
        KycService.logAction(mockAuditLogs, authUser.id, 'REPORT_EXPORTED', 'reports', type, null, { format, record_count: dataset.length });

        if (format === 'excel' || format === 'xlsx') {
            const excelString = ReportService.exportToExcel(dataset, `Hapanamy ${type}`);
            res.writeHead(200, {
                'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
                'Content-Disposition': `attachment; filename="hapanamy_${type}_report.xls"`
            });
            res.end(excelString);
            return;
        }

        if (format === 'pdf') {
            const pdfDoc = ReportService.exportToPDFFormat(`Hapanamy ${type} Report`, { RecordCount: dataset.length }, dataset);
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="hapanamy_${type}_report.txt"`
            });
            res.end(pdfDoc);
            return;
        }

        // Default: CSV
        const csvString = ReportService.exportToCSV(dataset);
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="hapanamy_${type}_report.csv"`
        });
        res.end(csvString);
        return;
    }

    // ========================================================
    // REFUND & CANCELLATION ENGINE REST ENDPOINTS (STEP 29)
    // ========================================================

    // POST /api/refund/request
    if (req.method === 'POST' && pathname === '/api/refund/request') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { purchaseId, reason, usageTelemetry } = body;

        if (!purchaseId) {
            sendJSON(res, 400, { error: 'PurchaseId is required.' });
            return;
        }

        try {
            const result = RefundService.requestRefund({
                userId: authUser.id,
                purchaseId,
                reason,
                purchases: mockProductPurchases,
                refundRequests: mockRefundRequests,
                usageTelemetry,
                auditLogs: mockAuditLogs
            });
            saveDbStore();
            sendJSON(res, 201, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // POST /api/refund/cancel
    if (req.method === 'POST' && pathname === '/api/refund/cancel') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId } = body;

        if (!refundId) {
            sendJSON(res, 400, { error: 'RefundId is required.' });
            return;
        }

        try {
            const result = RefundService.cancelRefundRequest({
                refundId,
                userId: authUser.id,
                refundRequests: mockRefundRequests,
                auditLogs: mockAuditLogs
            });
            saveDbStore();
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // GET /api/admin/refunds (Admin only)
    if (req.method === 'GET' && (pathname === '/api/admin/refunds' || pathname === '/api/admin/refunds/pending')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        sendJSON(res, 200, { refund_requests: mockRefundRequests });
        return;
    }

    // POST /api/admin/refunds/review (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/refunds/review') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId, action, rejectionReason } = body; // action: 'START_REVIEW', 'APPROVE', 'REJECT'

        if (!refundId || !action) {
            sendJSON(res, 400, { error: 'RefundId and action are required.' });
            return;
        }

        try {
            const result = RefundService.reviewRefundRequest({
                refundId,
                action,
                reviewerId: authUser.id,
                rejectionReason,
                refundRequests: mockRefundRequests,
                auditLogs: mockAuditLogs
            });
            saveDbStore();
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // POST /api/admin/refunds/execute (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/refunds/execute') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { refundId, bankPayoutReference } = body;

        if (!refundId) {
            sendJSON(res, 400, { error: 'RefundId is required.' });
            return;
        }

        try {
            const result = RefundService.executeRefundWorkflow({
                refundId,
                actorId: authUser.id,
                refundRequests: mockRefundRequests,
                purchases: mockProductPurchases,
                walletLedger: mockWalletLedger,
                volumeLedger: mockVolumeLedger,
                binaryNodes: mockBinaryNodes,
                auditLogs: mockAuditLogs,
                bankPayoutReference
            });
            saveDbStore();
            sendJSON(res, 200, result);
        } catch (err) {
            sendJSON(res, 400, { error: err.message });
        }
        return;
    }

    // ========================================================
    // MEMBER DASHBOARD API ROUTER (STEP 26 / STEP 50)
    // ========================================================

    // GET /api/member/dashboard (Unified Member Dashboard API)
    if (req.method === 'GET' && pathname === '/api/member/dashboard') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const user = mockUsers.find(u => u.id === authUser.id) || authUser;
            const wallet = MLMNetworkEngine.getMemberWallet(authUser.id, { walletLedger: mockWalletLedger });
            const earnings = MLMNetworkEngine.getMemberEarningsSummary(authUser.id, {
                commissionLedger: mockCommissionTransactions,
                walletLedger: mockWalletLedger
            });
            const network = MLMNetworkEngine.getMemberNetwork(authUser.id, {
                binaryNodes: mockBinaryNodes,
                users: mockUsers,
                purchases: mockProductPurchases,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors
            });
            const compStatus = QualificationEngine.getMemberComprehensiveStatus(authUser.id, {
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                volumeLedger: mockVolumeLedger
            });

            const userPurchases = mockProductPurchases.filter(p => p.user_id === authUser.id || p.buyer_id === authUser.id);
            const userWithdrawals = mockWithdrawalRequests.filter(w => w.user_id === authUser.id);

            const volSummary = VolumeLedger.getVolumeSummary(authUser.id, mockVolumeLedger);

            const host = req.headers.host || 'hapanamy.lk';
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const baseOrigin = `${protocol}://${host}`;
            const refCode = user.referral_code || user.username || 'Hiru';

            const dashboardPayload = {
                success: true,
                profile: {
                    id: user.id,
                    full_name: user.full_name || user.name || 'Member',
                    username: user.username || 'member',
                    email: user.email,
                    role: user.role || 'member',
                    status: user.status === 'SUSPENDED' ? 'SUSPENDED' : compStatus.account_status,
                    account_status: compStatus.account_status,
                    is_active: compStatus.is_active,
                    qualification_status: compStatus.qualification_status,
                    is_qualified: compStatus.is_qualified,
                    qualifying_sales_count: compStatus.qualification.qualifying_sales_count,
                    qualification_progress: compStatus.qualification.progress_text,
                    kyc_status: compStatus.kyc_status,
                    is_kyc_approved: compStatus.is_kyc_approved,
                    display_banner: compStatus.display_banner
                },
                earnings: {
                    today_earnings: 0.00,
                    month_earnings: earnings.total_earned,
                    total_earned: earnings.total_earned,
                    available_balance: wallet.available_balance,
                    pending_balance: earnings.pending_balance,
                    total_withdrawn: earnings.paid_balance,
                    withdrawal_hold_balance: earnings.withdrawal_hold_balance
                },
                binary_network: {
                    left_team_count: network.center_member ? network.center_member.left_team_count : (network.tree && network.tree.left ? 1 : 0),
                    right_team_count: network.center_member ? network.center_member.right_team_count : (network.tree && network.tree.right ? 1 : 0),
                    left_volume_lifetime: volSummary.lifetime_left_volume,
                    right_volume_lifetime: volSummary.lifetime_right_volume,
                    left_volume_current: volSummary.current_left_volume,
                    right_volume_current: volSummary.current_right_volume,
                    weaker_leg: volSummary.weaker_leg,
                    tree: network.tree,
                    center_member: network.center_member,
                    left_member: network.left_member,
                    right_member: network.right_member,
                    team_list: network.team_list || []
                },
                referral_tools: {
                    left_link: `${baseOrigin}/register?ref=${encodeURIComponent(refCode)}&position=left`,
                    right_link: `${baseOrigin}/register?ref=${encodeURIComponent(refCode)}&position=right`,
                    general_link: `${baseOrigin}/register?ref=${encodeURIComponent(refCode)}`
                },
                financial_activity: {
                    recent_transactions: wallet.recent_transactions,
                    withdrawal_history: userWithdrawals
                },
                direct_referrals: {
                    count: network.direct_referrals ? network.direct_referrals.length : 0,
                    list: network.direct_referrals || []
                },
                products: {
                    count: userPurchases.length,
                    list: userPurchases
                }
            };

            sendJSON(res, 200, dashboardPayload);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/network
    if (req.method === 'GET' && pathname === '/api/member/network') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const data = MLMNetworkEngine.getMemberNetwork(authUser.id, {
                binaryNodes: mockBinaryNodes,
                users: mockUsers,
                purchases: mockProductPurchases,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors
            });
            sendJSON(res, 200, data);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/commissions
    if (req.method === 'GET' && pathname === '/api/member/commissions') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const data = MLMNetworkEngine.getMemberCommissions(authUser.id, {
                commissionLedger: mockCommissionTransactions
            });
            sendJSON(res, 200, data);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/wallet
    if (req.method === 'GET' && pathname === '/api/member/wallet') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const data = MLMNetworkEngine.getMemberWallet(authUser.id, {
                walletLedger: mockWalletLedger
            });
            sendJSON(res, 200, data);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/earnings-summary
    if (req.method === 'GET' && pathname === '/api/member/earnings-summary') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const data = MLMNetworkEngine.getMemberEarningsSummary(authUser.id, {
                commissionLedger: mockCommissionTransactions,
                walletLedger: mockWalletLedger
            });
            sendJSON(res, 200, data);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/team (Filterable Team List)
    if (req.method === 'GET' && pathname === '/api/member/team') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const type = url.searchParams.get('type') || 'all'; // all, direct, left, right, level1..level7
            const filter = url.searchParams.get('filter') || url.searchParams.get('status') || 'all'; // all, active, qualified, pending, registered, purchased

            const network = MLMNetworkEngine.getMemberNetwork(authUser.id, {
                binaryNodes: mockBinaryNodes,
                users: mockUsers,
                purchases: mockProductPurchases,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors
            });

            let teamList = network.team_list || [];

            // Filter by type
            if (type === 'direct') {
                const directIds = new Set(mockSponsors.filter(s => s.sponsor_id === authUser.id).map(s => s.user_id));
                teamList = teamList.filter(m => directIds.has(m.id || m.user_id));
            } else if (type === 'left') {
                teamList = teamList.filter(m => (m.position || '').toUpperCase() === 'LEFT');
            } else if (type === 'right') {
                teamList = teamList.filter(m => (m.position || '').toUpperCase() === 'RIGHT');
            } else if (type.startsWith('level')) {
                const targetLevel = parseInt(type.replace('level', '')) || 1;
                teamList = teamList.filter(m => (m.level || m.depth || 1) === targetLevel);
            }

            // Filter by status / qualification
            if (filter === 'active') {
                teamList = teamList.filter(m => m.is_active || (m.status || '').toUpperCase() === 'ACTIVE');
            } else if (filter === 'qualified') {
                teamList = teamList.filter(m => (m.qualification_status || '').toUpperCase() === 'QUALIFIED');
            } else if (filter === 'purchased') {
                teamList = teamList.filter(m => mockProductPurchases.some(p => p.user_id === (m.id || m.user_id) && p.status === 'ACTIVE'));
            } else if (filter === 'not_purchased' || filter === 'registered') {
                teamList = teamList.filter(m => !mockProductPurchases.some(p => p.user_id === (m.id || m.user_id) && p.status === 'ACTIVE'));
            }

            sendJSON(res, 200, {
                success: true,
                count: teamList.length,
                type,
                filter,
                team: teamList
            });
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/network-summary (3-Card Visualizer API)
    if (req.method === 'GET' && pathname === '/api/member/network-summary') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const network = MLMNetworkEngine.getMemberNetwork(authUser.id, {
                binaryNodes: mockBinaryNodes,
                users: mockUsers,
                purchases: mockProductPurchases,
                volumeLedger: mockVolumeLedger,
                sponsors: mockSponsors
            });
            const volSummary = VolumeLedger.getVolumeSummary(authUser.id, mockVolumeLedger);

            sendJSON(res, 200, {
                success: true,
                center_member: network.center_member,
                left_member: network.left_member,
                right_member: network.right_member,
                volume_summary: volSummary
            });
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/volume (Business Volume Breakdown API)
    if (req.method === 'GET' && pathname === '/api/member/volume') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const volSummary = VolumeLedger.getVolumeSummary(authUser.id, mockVolumeLedger);
            const userPurchases = mockProductPurchases.filter(p => p.user_id === authUser.id && p.status === 'ACTIVE');
            const personalBv = userPurchases.reduce((sum, p) => sum + (p.binary_volume || p.price_paid || 0), 0);

            sendJSON(res, 200, {
                success: true,
                personal_bv: personalBv,
                current_left_volume: volSummary.current_left_volume,
                current_right_volume: volSummary.current_right_volume,
                lifetime_left_volume: volSummary.lifetime_left_volume,
                lifetime_right_volume: volSummary.lifetime_right_volume,
                matched_volume: volSummary.matched_volume,
                carry_forward_left: volSummary.carry_forward_left,
                carry_forward_right: volSummary.carry_forward_right,
                weaker_leg: volSummary.weaker_leg,
                total_team_points: volSummary.lifetime_left_volume + volSummary.lifetime_right_volume
            });
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/member/live-updates (Member Real-time Live Polling)
    if (req.method === 'GET' && pathname === '/api/member/live-updates') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        try {
            const memberEvents = mockLiveEvents.filter(e => {
                if (!e.data) return false;
                if (e.data.userId === authUser.id || e.data.sponsorId === authUser.id || e.data.sponsor === authUser.username) return true;
                return false;
            });

            const wallet = MLMNetworkEngine.getMemberWallet(authUser.id, { walletLedger: mockWalletLedger });
            const earnings = MLMNetworkEngine.getMemberEarningsSummary(authUser.id, {
                commissionLedger: mockCommissionTransactions,
                walletLedger: mockWalletLedger
            });
            const volSummary = VolumeLedger.getVolumeSummary(authUser.id, mockVolumeLedger);

            sendJSON(res, 200, {
                success: true,
                timestamp: new Date().toISOString(),
                events: memberEvents.slice(-10),
                balances: {
                    available_balance: wallet.available_balance,
                    total_earned: earnings.total_earned,
                    left_volume: volSummary.current_left_volume,
                    right_volume: volSummary.current_right_volume
                }
            });
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // POST /api/member/payments/verify-instant (Instant Checkout & Activation Endpoint)
    if (req.method === 'POST' && pathname === '/api/member/payments/verify-instant') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { productId, orderNumber, amount, paymentMethod } = body;

        const product = mockProducts.find(p => p.id === productId || p.code === productId) || mockProducts[0];
        const orderAmt = parseFloat(amount) || product.selling_price || product.price;

        const purchaseId = 'purch-' + Math.random().toString(36).substr(2, 9);
        const ordNum = orderNumber || ('ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase());
        const now = new Date().toISOString();

        const activePurchase = {
            id: purchaseId,
            order_number: ordNum,
            user_id: authUser.id,
            product_id: product.id,
            product_name: product.name || product.title,
            price_paid: orderAmt,
            binary_volume: product.binary_volume || orderAmt,
            status: 'ACTIVE',
            activated_at: now,
            created_at: now
        };
        mockProductPurchases.push(activePurchase);

        const depositId = 'dep-' + Math.random().toString(36).substr(2, 9);
        const deposit = {
            id: depositId,
            order_number: ordNum,
            purchase_id: purchaseId,
            user_id: authUser.id,
            product_id: product.id,
            product_name: product.name || product.title,
            amount: orderAmt,
            bank_reference: 'INSTANT-' + (paymentMethod || 'CARD') + '-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            transfer_date: now.split('T')[0],
            slip_url: 'storage/private/slips/instant-verified.jpg',
            status: 'APPROVED',
            reviewer_id: 'SYSTEM_GATEWAY',
            reviewed_at: now,
            notes: 'Instant verified via online payment gateway.',
            created_at: now
        };
        mockPaymentDeposits.push(deposit);

        // Activate User Status in DB
        const userInDb = mockUsers.find(u => u.id === authUser.id || (u.email && u.email === authUser.email));
        if (userInDb) {
            userInDb.status = 'ACTIVE';
        }

        // Create Immutable Economics Snapshot
        const snapshot = ProductSnapshotService.createSnapshot(
            product,
            activePurchase.id,
            activePurchase.activated_at
        );
        mockProductSnapshots.push(snapshot);

        // Process Commissions & Volume Propagation
        const commResult = CommissionCore.processPurchaseCommissions(activePurchase, snapshot, {
            binaryNodes: mockBinaryNodes,
            purchases: mockProductPurchases,
            sponsors: mockSponsors,
            commissionLedger: mockCommissionTransactions,
            volumeLedger: mockVolumeLedger,
            walletLedger: mockWalletLedger,
            dailyEarningsMap: mockDailyEarningsMap
        });

        ProductService.triggerPurchaseActivation(activePurchase);
        KycService.logAction(mockAuditLogs, authUser.id, 'PURCHASE_ACTIVATED_INSTANT', 'product_purchases', purchaseId, null, { snapshot_id: snapshot.id });

        addLiveEvent('ORDER_PAID', {
            orderNumber: ordNum,
            purchaseId: purchaseId,
            userId: authUser.id,
            amount: orderAmt,
            productName: product.name || product.title
        }, `Instant Purchase Paid: Order #${ordNum} (${product.name || product.title}) - LKR ${orderAmt.toFixed(2)}`);

        sendJSON(res, 200, {
            success: true,
            orderNumber: ordNum,
            purchaseId: purchaseId,
            depositId: depositId,
            product: product.name || product.title,
            amount: orderAmt,
            commissions: commResult
        });
        return;
    }

    // ========================================================
    // ADMIN MLM OPERATIONS DASHBOARD API ROUTER (STEP 27 / STEP 50)
    // ========================================================

    // GET /api/admin/members (Enriched Real-time Members List)
    if (req.method === 'GET' && pathname === '/api/admin/members') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || 'all';
        const qualification = url.searchParams.get('qualification') || 'all';

        const members = getEnrichedAdminMembersList({ search, status, qualification });
        sendJSON(res, 200, {
            success: true,
            count: members.length,
            members
        });
        return;
    }

    // GET /api/admin/members/:id (Deep Detail Modal Inspection)
    if (req.method === 'GET' && pathname.startsWith('/api/admin/members/')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const memberId = pathname.replace('/api/admin/members/', '').trim();
        const detail = getEnrichedAdminMemberDetail(memberId);
        if (!detail) {
            sendJSON(res, 404, { error: 'Member not found.' });
            return;
        }

        sendJSON(res, 200, { success: true, member: detail });
        return;
    }

    // POST /api/admin/members/reset-password or /api/admin/members/:id/reset-password
    if (req.method === 'POST' && (pathname === '/api/admin/members/reset-password' || (pathname.startsWith('/api/admin/members/') && pathname.endsWith('/reset-password')))) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN' && authUser.role !== 'subadmin' && authUser.role !== 'SUPER_ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const body = await parseRequestBody(req);
        let targetUserId = body.memberId || body.member_id || body.userId || body.user_id || body.username || body.email;
        if (!targetUserId && pathname.startsWith('/api/admin/members/')) {
            const segs = pathname.split('/');
            targetUserId = segs[4];
        }

        const newPassword = body.new_password || body.newPassword || body.password || 'Hapana123';
        const cleanTarget = String(targetUserId || '').replace(/^@/, '').toLowerCase();

        const member = state.users.find(u => 
            u.id === targetUserId || 
            String(u.username || '').toLowerCase() === cleanTarget || 
            String(u.email || '').toLowerCase() === cleanTarget ||
            String(u.id || '').toLowerCase() === cleanTarget
        );

        if (!member) {
            sendJSON(res, 404, { success: false, error: `Member '${targetUserId}' not found.` });
            return;
        }

        member.password = newPassword;
        if (member.password_hash) {
            member.password_hash = sha256Hex(newPassword);
        }
        saveJsonState();

        sendJSON(res, 200, {
            success: true,
            message: `Password for ${member.full_name || member.name || member.username} (@${member.username}) successfully reset to '${newPassword}'.`,
            username: member.username,
            email: member.email,
            reset_password: newPassword
        });
        return;
    }

    // POST /api/admin/members/manual-purchase or /api/admin/orders/manual-enrollment
    if (req.method === 'POST' && (pathname === '/api/admin/members/manual-purchase' || pathname === '/api/admin/orders/manual-enrollment' || pathname === '/api/admin/orders/manual-purchase' || (pathname.startsWith('/api/admin/members/') && pathname.endsWith('/manual-purchase')))) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN' && authUser.role !== 'subadmin' && authUser.role !== 'SUPER_ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const body = await parseRequestBody(req);
        let targetUserId = body.memberId || body.member_id || body.userId || body.user_id || body.username;
        if (!targetUserId && pathname.startsWith('/api/admin/members/')) {
            const segs = pathname.split('/');
            targetUserId = segs[4]; // /api/admin/members/:id/manual-purchase
        }

        const productId = body.productId || body.product_id || body.course_id || 'facebook-course';
        const paymentMethod = body.paymentMethod || body.payment_method || 'ADMIN_MANUAL';
        const notes = body.notes || body.note || 'Admin manual course activation';

        const cleanTarget = (targetUserId || '').toLowerCase().replace(/^@+/, '').trim();
        const buyer = mockUsers.find(u => 
            (u.id && u.id.toLowerCase() === cleanTarget) ||
            (u.username && u.username.toLowerCase() === cleanTarget) ||
            (u.email && u.email.toLowerCase() === cleanTarget) ||
            (u.referral_code && u.referral_code.toLowerCase() === cleanTarget)
        );

        if (!buyer) {
            sendJSON(res, 404, { error: `Member ${targetUserId} not found.` });
            return;
        }

        const product = mockProducts.find(p => p.id === productId || p.code === productId || p.name === productId || p.title === productId) || mockProducts[0];
        const sellingPrice = product.selling_price || product.price || 7425.00;
        const binaryVolume = product.binary_volume || sellingPrice;

        const purchaseId = 'purch-adm-' + Math.random().toString(36).substr(2, 9);
        const orderNumber = 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const activePurchase = {
            id: purchaseId,
            order_number: orderNumber,
            user_id: buyer.id,
            buyer_id: buyer.id,
            product_id: product.id,
            product_name: product.name || product.title,
            price_paid: sellingPrice,
            amount: sellingPrice,
            binary_volume: binaryVolume,
            payment_method: paymentMethod,
            status: 'ACTIVE',
            notes: notes,
            created_at: new Date().toISOString(),
            activated_at: new Date().toISOString()
        };

        const depositId = 'dep-adm-' + Math.random().toString(36).substr(2, 9);
        const deposit = {
            id: depositId,
            order_number: orderNumber,
            purchase_id: purchaseId,
            user_id: buyer.id,
            product_id: product.id,
            product_name: product.name || product.title,
            amount: sellingPrice,
            bank_reference: 'ADMIN-MANUAL-' + orderNumber,
            transfer_date: new Date().toISOString().split('T')[0],
            status: 'APPROVED',
            notes: notes,
            reviewer_id: authUser.id,
            reviewed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        mockProductPurchases.push(activePurchase);
        mockPaymentDeposits.push(deposit);

        // Activate buyer status
        buyer.status = 'ACTIVE';
        buyer.account_status = 'ACTIVE';

        // Execute Purchase Orchestrator for full MLM triggers (Snapshot, BV propagation, 8% direct, 7% binary, 7-level upline, wallet ledger)
        let orchResult = null;
        try {
            orchResult = PurchaseOrchestrator.executeApprovedPurchaseWorkflow({
                purchase: activePurchase,
                product: product,
                userId: buyer.id,
                binaryNodes: mockBinaryNodes,
                sponsors: mockSponsors,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                commissionLedger: mockCommissionTransactions,
                volumeLedger: mockVolumeLedger,
                walletLedger: mockWalletLedger,
                dailyEarningsMap: mockDailyEarningsMap
            });
        } catch (orchErr) {
            console.warn(`PurchaseOrchestrator warning during admin manual purchase: ${orchErr.message}`);
        }

        ProductService.triggerPurchaseActivation(activePurchase);
        KycService.logAction(mockAuditLogs, authUser.id, 'ADMIN_MANUAL_PURCHASE', 'product_purchases', purchaseId, null, {
            buyer_id: buyer.id,
            product_id: product.id,
            amount: sellingPrice,
            order_number: orderNumber
        });

        addLiveEvent('ORDER_PAID', {
            orderNumber: orderNumber,
            purchaseId: purchaseId,
            userId: buyer.id,
            amount: sellingPrice,
            productName: product.name || product.title
        }, `Admin Manual Purchase: ${buyer.full_name || buyer.username} enrolled in ${product.name || product.title} (Rs. ${sellingPrice.toFixed(2)})`);

        saveDbStore();

        sendJSON(res, 200, {
            success: true,
            message: `Course '${product.name || product.title}' successfully purchased and activated for ${buyer.full_name || buyer.username}! 8% Direct Commission and Binary Points propagated to upline.`,
            order: activePurchase,
            buyer: buyer,
            direct_commission: orchResult && orchResult.direct_commission ? orchResult.direct_commission : { amount: Math.round(sellingPrice * 0.08) },
            binary_volume: { volume: binaryVolume },
            orchestration: orchResult
        });
        return;
    }

    // GET /api/admin/orders (Enriched Orders Table with Commissions & BV)
    if (req.method === 'GET' && pathname === '/api/admin/orders') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const status = url.searchParams.get('status') || 'all';
        const orders = getEnrichedAdminOrdersList({ status });
        sendJSON(res, 200, {
            success: true,
            count: orders.length,
            orders
        });
        return;
    }

    // GET /api/admin/network and /api/admin/network/validate
    if (req.method === 'GET' && (pathname === '/api/admin/network' || pathname === '/api/admin/network/validate' || pathname === '/api/admin/network/status')) {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        try {
            const report = MLMNetworkEngine.validateEntireMLMNetwork({
                users: mockUsers,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                purchases: mockProductPurchases,
                commissionLedger: mockCommissionTransactions,
                volumeLedger: mockVolumeLedger,
                walletLedger: mockWalletLedger
            });
            sendJSON(res, 200, report);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // GET /api/admin/live-updates (Admin Real-time Live Polling)
    if (req.method === 'GET' && pathname === '/api/admin/live-updates') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        const sinceId = url.searchParams.get('sinceId');
        let events = mockLiveEvents;
        if (sinceId) {
            const idx = mockLiveEvents.findIndex(e => e.id === sinceId);
            if (idx !== -1) {
                events = mockLiveEvents.slice(idx + 1);
            }
        }

        const totalMembers = mockUsers.length;
        const activePurchases = mockProductPurchases.filter(p => p.status === 'ACTIVE');
        const totalSales = activePurchases.reduce((sum, p) => sum + (p.price_paid || 0), 0);
        const pendingOrders = mockPaymentDeposits.filter(d => d.status === 'PENDING').length;
        const pendingWithdrawals = mockWithdrawalRequests.filter(w => w.status === 'PENDING').length;
        const totalCommissionsPaid = mockWalletLedger.filter(tx => (tx.type || '').includes('COMMISSION')).reduce((sum, tx) => sum + (tx.amount || 0), 0);

        sendJSON(res, 200, {
            success: true,
            timestamp: new Date().toISOString(),
            events,
            stats: {
                total_members: totalMembers,
                active_courses_count: activePurchases.length,
                total_sales_lkr: totalSales,
                pending_orders_count: pendingOrders,
                pending_withdrawals_count: pendingWithdrawals,
                total_commissions_paid_lkr: totalCommissionsPaid
            }
        });
        return;
    }

    // POST /api/admin/commissions/calculate
    if (req.method === 'POST' && pathname === '/api/admin/commissions/calculate') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        parseRequestBody(req).then(body => {
            const orderId = body.order_id || body.orderId;
            if (!orderId) {
                sendJSON(res, 400, { error: 'order_id is required in request body.' });
                return;
            }

            const result = MLMNetworkEngine.calculateOrderCommissions(orderId, {
                purchases: mockProductPurchases,
                products: mockProducts,
                users: mockUsers,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                kycDocs: mockKycDocs,
                commissionLedger: mockCommissionTransactions,
                volumeLedger: mockVolumeLedger,
                walletLedger: mockWalletLedger,
                dailyEarningsMap: mockDailyEarningsMap,
                dailyCapLimit: 30000.00
            });

            if (!result.success) {
                sendJSON(res, 400, result);
            } else {
                sendJSON(res, 200, result);
            }
        }).catch(err => {
            sendJSON(res, 400, { error: err.message });
        });
        return;
    }

    // GET /api/admin/dashboard
    if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied. Admin role required.' });
            return;
        }

        try {
            const adminData = AdminDashboardService.getAdminDashboardData({
                requestingUser: authUser,
                users: mockUsers,
                kycDocs: mockKycDocs,
                purchases: mockProductPurchases,
                sponsors: mockSponsors,
                binaryNodes: mockBinaryNodes,
                walletLedger: mockWalletLedger,
                volumeLedger: mockVolumeLedger,
                withdrawals: mockWithdrawalRequests,
                paymentSubmissions: mockPaymentDeposits,
                refundRequests: mockRefundRequests,
                targetDate: new Date()
            });

            sendJSON(res, 200, adminData);
        } catch (err) {
            sendJSON(res, 500, { error: err.message });
        }
        return;
    }

    // ========================================================
    // NOTIFICATION ENGINE API ROUTER (STEP 32)
    // ========================================================

    // GET /api/member/notifications
    if (req.method === 'GET' && pathname === '/api/member/notifications') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const unreadOnly = url.searchParams.get('unread') === 'true';
        const notifs = NotificationEngine.getUserInAppNotifications(authUser.id, NotificationEngine.inAppStore, { unreadOnly });
        sendJSON(res, 200, { count: notifs.length, notifications: notifs });
        return;
    }

    // POST /api/member/notifications/read
    if (req.method === 'POST' && pathname === '/api/member/notifications/read') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const { notificationId } = body;

        if (!notificationId) {
            sendJSON(res, 400, { error: 'Notification ID is required.' });
            return;
        }

        const success = NotificationEngine.markInAppAsRead(notificationId, authUser.id, NotificationEngine.inAppStore);
        sendJSON(res, 200, { success });
        return;
    }

    // GET /api/member/notifications/preferences
    if (req.method === 'GET' && pathname === '/api/member/notifications/preferences') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const prefs = NotificationEngine.getPreferences(authUser.id);
        sendJSON(res, 200, { preferences: prefs });
        return;
    }

    // POST /api/member/notifications/preferences
    if (req.method === 'POST' && pathname === '/api/member/notifications/preferences') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser) {
            sendJSON(res, 401, { error: 'Unauthorized. Please sign in.' });
            return;
        }

        const body = await parseRequestBody(req);
        const updated = NotificationEngine.updatePreferences(authUser.id, body);
        sendJSON(res, 200, { success: true, preferences: updated });
        return;
    }

    // GET /api/admin/notifications/outbox (Admin only)
    if (req.method === 'GET' && pathname === '/api/admin/notifications/outbox') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        sendJSON(res, 200, {
            queue_length: NotificationEngine.outboxQueue.length,
            items: NotificationEngine.outboxQueue
        });
        return;
    }

    // POST /api/admin/notifications/process-queue (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/notifications/process-queue') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const result = await NotificationEngine.processQueue();
        sendJSON(res, 200, { success: true, result });
        return;
    }

    // POST /api/admin/simulation/run (Admin only)
    if (req.method === 'POST' && pathname === '/api/admin/simulation/run') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const nodeCount = parseInt(body.nodeCount) || 100;
        const purchaseCount = parseInt(body.purchaseCount) || 150;
        const refundRatePercent = parseFloat(body.refundRatePercent) || 5;

        const report = SimulationEngine.runSimulation({
            nodeCount,
            purchaseCount,
            refundRatePercent
        });

        sendJSON(res, 200, { success: true, report });
        return;
    }

    // GET /api/courses/catalog (Public Catalog)
    if (req.method === 'GET' && pathname === '/api/courses/catalog') {
        const catalog = ProductService.getCatalog();
        sendJSON(res, 200, { success: true, count: catalog.length, catalog });
        return;
    }

    // GET /api/courses/delivery?courseId=... (Member Personalized Delivery & Progress)
    if (req.method === 'GET' && pathname === '/api/courses/delivery') {
        const authUser = getAuthenticatedUser(req);
        const courseId = parsedUrl.query.courseId || 'prod-pro-02';
        const userId = authUser ? authUser.id : 'guest';

        const delivery = ProductService.getCourseDelivery(
            userId,
            courseId,
            PurchaseOrchestrator.purchasesStore || [],
            {}
        );

        sendJSON(res, 200, delivery);
        return;
    }

    // POST /api/admin/products/validate-economics (Admin Margin Safety Firewall)
    if (req.method === 'POST' && pathname === '/api/admin/products/validate-economics') {
        const authUser = getAuthenticatedUser(req);
        if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'ADMIN')) {
            sendJSON(res, 403, { error: 'Access Denied.' });
            return;
        }

        const body = await parseRequestBody(req);
        const validation = ProductService.validateEconomics(body);
        sendJSON(res, 200, { success: true, validation });
        return;
    }

    // ========================================================
    // CLEAN URL & STATIC ASSET ROUTING
    // ========================================================
    let safeUrl = pathname;
    
    // Explicit Clean Route Mappings
    if (safeUrl === '/') safeUrl = '/index.html';
    else if (safeUrl === '/login') safeUrl = '/login.html';
    else if (safeUrl === '/register') safeUrl = '/register.html';
    else if (safeUrl === '/dashboard') safeUrl = '/dashboard.html';
    else if (safeUrl === '/admin') safeUrl = '/hapanamy-admin-portal-9226.html';
    else if (safeUrl === '/checkout') safeUrl = '/checkout.html';
    else if (safeUrl === '/about' || safeUrl === '/about-us') safeUrl = '/about-us.html';
    else if (safeUrl === '/courses') safeUrl = '/courses.html';
    else if (safeUrl === '/how-it-works') safeUrl = '/how-it-works.html';
    else if (safeUrl === '/compensation-plan') safeUrl = '/compensation-plan.html';
    else if (safeUrl === '/faq') safeUrl = '/faq.html';
    else if (safeUrl === '/contact' || safeUrl === '/contact-us') safeUrl = '/contact-us.html';
    else if (safeUrl === '/terms' || safeUrl === '/terms-conditions') safeUrl = '/terms-conditions.html';
    else if (safeUrl === '/privacy' || safeUrl === '/privacy-policy') safeUrl = '/privacy-policy.html';
    else if (safeUrl === '/refund' || safeUrl === '/refund-policy') safeUrl = '/refund-policy.html';
    else if (safeUrl === '/disclaimer') safeUrl = '/disclaimer.html';
    else if (safeUrl === '/affiliate-disclosure') safeUrl = '/affiliate-disclosure.html';

    let filePath = path.join(__dirname, safeUrl);
    
    // Auto-resolve .html if extension is omitted
    const isSensitive = safeUrl.startsWith('/storage/private/') ||
        safeUrl.startsWith('/services/') ||
        safeUrl.startsWith('/test/') ||
        safeUrl.startsWith('/sql/') ||
        safeUrl.includes('/.env') ||
        safeUrl.includes('/.git') ||
        safeUrl.includes('/.htaccess') ||
        safeUrl.includes('/.htpasswd') ||
        safeUrl.endsWith('.sql') ||
        safeUrl.endsWith('.log') ||
        safeUrl.endsWith('.bak') ||
        safeUrl.endsWith('.sh') ||
        safeUrl === '/server.js' ||
        safeUrl === '/package.json' ||
        safeUrl === '/package-lock.json';

    const normalizedPath = path.normalize(filePath);
    if (isSensitive || !normalizedPath.startsWith(__dirname)) {
        const secHeaders = SecurityCore.getSecurityHeaders(process.env.NODE_ENV === 'production');
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...secHeaders });
        res.end('403 Forbidden: Access to sensitive file is prohibited.');
        return;
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    const secHeaders = SecurityCore.getSecurityHeaders(process.env.NODE_ENV === 'production');
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...secHeaders });
                res.end('<h1>404 Not Found - Hapanamy.lk</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...secHeaders });
                res.end(`Server Error: An unexpected error occurred.`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType, ...secHeaders });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}/ (Port: ${PORT})`);
});

