// Hapanamy.lk Comprehensive Product & Course Delivery Service (STEPS 4, 5, 6)
// Handles complete course module delivery, video lessons, categories, progress tracking,
// digital downloads (E-books, AI prompts, ZIPs), entitlement access rules, catalog & checkout,
// and automated Product Economics Margin Protection.

const ProductEconomicsCalculator = require('./product-economics-calculator');
const ProductCommissionValidator = require('./product-commission-validator');

const ProductService = {
    eventListeners: [],

    /**
     * Default authoritative course catalog with full pricing, curriculum, benefits, and economics.
     */
    getCatalog() {
        return [
            {
                id: 'prod-starter-01',
                slug: 'digital-skills-starter',
                title: 'Digital Skills & Freelancing Starter',
                subtitle: 'Learn in-demand freelancing, Canva graphic design, and basic AI workflows.',
                category: 'FREELANCING_DESIGN',
                original_price: 20000.00,
                discount_price: 10000.00,
                selling_price: 10000.00,
                product_cost: 2000.00,
                minimum_company_profit: 2500.00,
                operating_cost_reserve: 500.00,
                payment_processing_reserve: 300.00,
                refund_risk_reserve: 200.00,
                tax_reserve: 800.00,
                other_reserve: 200.00,
                commission_safety_buffer: 500.00,
                direct_commission_rate: 8.00, // Rs. 800
                binary_commission_rate: 3.00, // Rs. 300 x 7 = Rs. 2,100
                max_binary_qualified_levels: 7,
                binary_volume: 10000.00,
                status: 'ACTIVE',
                thumbnail: 'assets/starter-thumb.jpg',
                benefits: [
                    'Master Fiverr and Upwork client acquisition',
                    'High-converting Canva social media graphic design',
                    'Basic ChatGPT prompting for content writing'
                ],
                what_you_get: [
                    '12 HD Video Lessons with lifetime access',
                    '5 Professional Canva Template Packs',
                    '1 Freelancing Starter Guide (PDF)',
                    'Official Certificate of Completion'
                ],
                modules: [
                    {
                        module_id: 'mod-1',
                        title: 'Module 1: Freelancing Fundamentals',
                        lessons: [
                            { id: 'les-101', title: 'Introduction to Digital Economy', duration: '12:40', video_url: 'https://cdn.hapanamy.lk/videos/starter/les-101.mp4' },
                            { id: 'les-102', title: 'Setting Up Your Profile on Upwork & Fiverr', duration: '18:15', video_url: 'https://cdn.hapanamy.lk/videos/starter/les-102.mp4' }
                        ]
                    },
                    {
                        module_id: 'mod-2',
                        title: 'Module 2: Canva & AI Design Masterclass',
                        lessons: [
                            { id: 'les-103', title: 'Designing High-Converting Social Ads', duration: '22:00', video_url: 'https://cdn.hapanamy.lk/videos/starter/les-103.mp4' },
                            { id: 'les-104', title: 'Automating Social Media Posts with AI', duration: '15:30', video_url: 'https://cdn.hapanamy.lk/videos/starter/les-104.mp4' }
                        ]
                    }
                ],
                downloads: [
                    { id: 'dl-101', title: 'Freelancing Client Proposal Templates', type: 'PDF', file_size: '2.4 MB', url: '/storage/downloads/starter/proposals.pdf' },
                    { id: 'dl-102', title: '500+ High-Conversion ChatGPT Prompts', type: 'EBOOK', file_size: '5.1 MB', url: '/storage/downloads/starter/prompts.pdf' },
                    { id: 'dl-103', title: 'Social Media Canva Starter Assets Pack', type: 'ZIP', file_size: '48.2 MB', url: '/storage/downloads/starter/canva-assets.zip' }
                ]
            },
            {
                id: 'prod-pro-02',
                slug: 'pro-trading-ai-masterclass',
                title: 'Professional Trading & AI Masterclass',
                subtitle: 'Master technical analysis, algorithmic trading strategies, and AI agent automation.',
                category: 'TRADING_FINTECH',
                original_price: 55000.00,
                discount_price: 27500.00,
                selling_price: 27500.00,
                product_cost: 5000.00,
                minimum_company_profit: 6875.00,
                operating_cost_reserve: 1375.00,
                payment_processing_reserve: 825.00,
                refund_risk_reserve: 550.00,
                tax_reserve: 2200.00,
                other_reserve: 550.00,
                commission_safety_buffer: 1375.00,
                direct_commission_rate: 8.00, // Rs. 2,200
                binary_commission_rate: 7.00, // Rs. 1,925 x 7 = Rs. 13,475
                max_binary_qualified_levels: 7,
                binary_volume: 27500.00,
                status: 'ACTIVE',
                thumbnail: 'assets/pro-thumb.jpg',
                benefits: [
                    'Advanced Forex & Crypto Price Action & Order Flow Mastery',
                    'AI Prompt Engineering for Market Trend Analysis',
                    'Risk Management Framework & Portfolio Protection'
                ],
                what_you_get: [
                    '35 In-Depth Video Masterclasses',
                    'Exclusive PineScript TradingView Indicators',
                    '2 Financial E-Books & Strategy Playbooks (PDF)',
                    'Private VIP Discord Mastermind Access'
                ],
                modules: [
                    {
                        module_id: 'mod-pro-1',
                        title: 'Module 1: Market Structure & Institutional Order Flow',
                        lessons: [
                            { id: 'les-201', title: 'Liquidity Pools & Smart Money Concepts', duration: '28:10', video_url: 'https://cdn.hapanamy.lk/videos/pro/les-201.mp4' },
                            { id: 'les-202', title: 'Fair Value Gaps & High-Probability Entries', duration: '34:45', video_url: 'https://cdn.hapanamy.lk/videos/pro/les-202.mp4' }
                        ]
                    },
                    {
                        module_id: 'mod-pro-2',
                        title: 'Module 2: AI Assisted Trading & Custom Indicators',
                        lessons: [
                            { id: 'les-203', title: 'Integrating ChatGPT & Claude for Sentiment Analysis', duration: '25:15', video_url: 'https://cdn.hapanamy.lk/videos/pro/les-203.mp4' },
                            { id: 'les-204', title: 'Deploying Automated Trading Alerts', duration: '30:00', video_url: 'https://cdn.hapanamy.lk/videos/pro/les-204.mp4' }
                        ]
                    }
                ],
                downloads: [
                    { id: 'dl-201', title: 'Institutional Smart Money Playbook', type: 'EBOOK', file_size: '14.8 MB', url: '/storage/downloads/pro/smc-playbook.pdf' },
                    { id: 'dl-202', title: 'TradingView PineScript Indicator Suite', type: 'ZIP', file_size: '1.2 MB', url: '/storage/downloads/pro/indicators.zip' },
                    { id: 'dl-203', title: 'Risk Calculation & Position Sizing Spreadsheet', type: 'TEMPLATES', file_size: '850 KB', url: '/storage/downloads/pro/risk-model.xlsx' }
                ]
            },
            {
                id: 'prod-elite-03',
                slug: 'elite-business-builder-suite',
                title: 'Elite Business Builder & Agency Suite',
                subtitle: 'Scale a high-ticket digital agency, automated sales funnels, and enterprise leadership.',
                category: 'ENTERPRISE_SCALING',
                original_price: 100000.00,
                discount_price: 50000.00,
                selling_price: 50000.00,
                product_cost: 8000.00,
                minimum_company_profit: 15000.00,
                operating_cost_reserve: 2500.00,
                payment_processing_reserve: 1500.00,
                refund_risk_reserve: 1000.00,
                tax_reserve: 4000.00,
                other_reserve: 1000.00,
                commission_safety_buffer: 2000.00,
                direct_commission_rate: 8.00, // Rs. 4,000
                binary_commission_rate: 5.00, // Rs. 2,500 x 7 = Rs. 17,500
                max_binary_qualified_levels: 7,
                binary_volume: 50000.00,
                status: 'ACTIVE',
                thumbnail: 'assets/elite-thumb.jpg',
                benefits: [
                    'Complete Agency Blueprint: Client Acquisition to Delivery',
                    'White-Label Sales Funnels and High-Converting Copy',
                    'Direct 1-on-1 Mentorship & Priority Executive Support'
                ],
                what_you_get: [
                    '50+ Masterclass Modules & Live Recorded Case Studies',
                    'Full High-Ticket Agency Funnel Templates (ClickFunnels/WordPress)',
                    'Legal Contracts, NDAs & Proposal Templates',
                    'Private Executive Mastermind Retreat Invitations'
                ],
                modules: [
                    {
                        module_id: 'mod-elite-1',
                        title: 'Module 1: Agency Foundation & Packaging',
                        lessons: [
                            { id: 'les-301', title: 'Creating High-Ticket Irresistible Offers', duration: '40:00', video_url: 'https://cdn.hapanamy.lk/videos/elite/les-301.mp4' },
                            { id: 'les-302', title: 'Client Onboarding & Contract Systems', duration: '32:20', video_url: 'https://cdn.hapanamy.lk/videos/elite/les-302.mp4' }
                        ]
                    }
                ],
                downloads: [
                    { id: 'dl-301', title: 'High-Ticket Agency Sales Scripts & Contracts', type: 'PDF', file_size: '8.4 MB', url: '/storage/downloads/elite/contracts.pdf' },
                    { id: 'dl-302', title: 'Full Funnel WordPress / Elementor Templates', type: 'ZIP', file_size: '124.5 MB', url: '/storage/downloads/elite/funnels.zip' },
                    { id: 'dl-303', title: 'Enterprise AI Content Automation Blueprint', type: 'EBOOK', file_size: '18.2 MB', url: '/storage/downloads/elite/ai-agency.pdf' }
                ]
            }
        ];
    },

    /**
     * Checks if a user is currently entitled to access a course.
     * Enforces: Payment Approved + Purchase Active + No Active Refund.
     */
    isUserEntitled(userId, productId, purchases = []) {
        if (!userId || !productId) return false;

        const activePurchase = purchases.find(p => 
            p.user_id === userId &&
            (p.product_id === productId || p.product_slug === productId) &&
            (p.status === 'APPROVED' || p.status === 'ACTIVE' || p.status === 'COMPLETED')
        );

        return !!activePurchase;
    },

    /**
     * Returns full personalized course content with unlock states, progress, and download links.
     */
    getCourseDelivery(userId, productId, purchases = [], progressData = {}) {
        const catalog = this.getCatalog();
        const course = catalog.find(c => c.id === productId || c.slug === productId);

        if (!course) {
            return { success: false, error: 'Course not found.' };
        }

        const entitled = this.isUserEntitled(userId, productId, purchases);
        const userProgress = progressData[userId] || {};
        const completedLessons = userProgress[course.id]?.completed_lessons || [];

        // Count total lessons
        let totalLessonsCount = 0;
        course.modules.forEach(m => totalLessonsCount += m.lessons.length);
        const completionPercent = totalLessonsCount > 0 
            ? Math.round((completedLessons.length / totalLessonsCount) * 100) 
            : 0;

        // Process modules with locked/unlocked state
        const deliveryModules = course.modules.map((m, mIdx) => ({
            ...m,
            lessons: m.lessons.map((les, lIdx) => {
                const isCompleted = completedLessons.includes(les.id);
                // First lesson unlocked as preview if not entitled; all unlocked if entitled
                const isUnlocked = entitled || (mIdx === 0 && lIdx === 0);
                return {
                    id: les.id,
                    title: les.title,
                    duration: les.duration,
                    video_url: isUnlocked ? les.video_url : null,
                    is_unlocked: isUnlocked,
                    is_completed: isCompleted
                };
            })
        }));

        return {
            success: true,
            course_id: course.id,
            title: course.title,
            is_entitled: entitled,
            progress: {
                completion_percent: completionPercent,
                completed_lessons_count: completedLessons.length,
                total_lessons_count: totalLessonsCount
            },
            modules: deliveryModules,
            downloads: entitled ? course.downloads : course.downloads.map(d => ({
                id: d.id,
                title: d.title,
                type: d.type,
                file_size: d.file_size,
                url: null, // Locked until purchased
                is_locked: true
            }))
        };
    },

    /**
     * Product Economics Safety Firewall Validation.
     * Evaluates whether a proposed product economics structure satisfies:
     * Total Possible Commission Exposure <= Allowed Profit Margin
     */
    validateEconomics(productInput) {
        const calc = ProductEconomicsCalculator.calculate(productInput);
        const val = ProductCommissionValidator.validate(calc);

        const totalPotentialCommissionExposure = calc.calculated.max_total_commission_exposure;
        const allowedProfitMargin = calc.calculated.gross_profit;
        const isSafe = val.status === 'ALLOW' && totalPotentialCommissionExposure <= allowedProfitMargin;

        return {
            status: val.status,
            is_safe: isSafe,
            selling_price: calc.calculated.selling_price,
            product_cost: calc.source.product_cost || 0,
            gross_profit: allowedProfitMargin,
            direct_commission: calc.calculated.direct_commission_amount,
            binary_per_level: calc.calculated.binary_commission_per_recipient,
            max_binary_levels: calc.source.max_binary_qualified_levels || 7,
            total_binary_exposure: calc.calculated.max_binary_commission_exposure,
            total_possible_commission_exposure: totalPotentialCommissionExposure,
            company_net_margin_protected: calc.calculated.remaining_company_margin,
            errors: val.reasons || []
        };
    },

    onPurchaseActivated(callback) {
        this.eventListeners.push(callback);
    },

    triggerPurchaseActivation(purchaseRecord) {
        this.eventListeners.forEach(listener => {
            try { listener(purchaseRecord); } catch (e) {}
        });
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductService;
}
