// Hapanamy.lk Global Frontend Configuration
const CONFIG = {
    APP_NAME: "Hapanamy.lk",
    APP_TAGLINE: "Connect • Learn • Grow • Earn",
    POSITIONING: "Sri Lanka's Digital Learning Campus",
    PRIMARY_PHONE: "+94 72 609 0050",
    PRIMARY_EMAIL: "info@hapanamy.lk",
    AFFILIATE_EMAIL: "affiliate@hapanamy.lk",
    AFFILIATE_COMMISSION_RATE: 0.15, // 15% Direct Commission
    AFFILIATE_COMMISSION_PERCENT: "15%",
    BASE_URL: "https://www.hapanamy.lk",
    
    // Google AdSense Configuration
    // Replace 'ca-pub-XXXXXXXXXXXXXXXX' with your verified Google AdSense Publisher ID (e.g. 'ca-pub-1234567890123456')
    ADSENSE_CLIENT_ID: "ca-pub-8211523479069192",
    ADSENSE_ENABLED: true,
    ADSENSE_AUTO_ADS: true,

    USE_CLOUD_DB: false, // LocalStorage fallback active by default; set true when Supabase credentials provided
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: ""
};

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
