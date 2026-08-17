// Hapanamy.lk Shared Database Adapter Service (Supabase Cloud + LocalStorage Fallback)
let supabaseClient = null;

function dbInit() {
    if (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' && CONFIG.USE_CLOUD_DB) {
        if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            try {
                supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
                console.log('🔌 Connected to Supabase Cloud Database!');
            } catch (e) {
                console.error('⚠️ Supabase connection error:', e);
            }
        }
    }
}

// Initialize on script load
dbInit();

// ==================== USERS DATABASE ====================
async function dbGetUsers() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('registered_users').select('*');
            if (!error && data) return data;
            console.warn('Supabase query failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase get users crash:', e);
        }
    }
    return JSON.parse(localStorage.getItem('hapanamy_registered_users')) || [];
}

async function dbAddUser(user) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('registered_users').insert([user]);
            if (!error) return true;
            console.warn('Supabase insert user failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase add user crash:', e);
        }
    }
    const users = JSON.parse(localStorage.getItem('hapanamy_registered_users')) || [];
    users.push(user);
    localStorage.setItem('hapanamy_registered_users', JSON.stringify(users));
    return true;
}

// ==================== BANK ORDERS / SLIPS ====================
async function dbGetOrders() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('bank_orders').select('*');
            if (!error && data) return data;
            console.warn('Supabase query failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase get orders crash:', e);
        }
    }
    return JSON.parse(localStorage.getItem('bank_slips_queue')) || [];
}

async function dbAddOrder(order) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('bank_orders').insert([order]);
            if (!error) return true;
            console.warn('Supabase insert order failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase add order crash:', e);
        }
    }
    const slips = JSON.parse(localStorage.getItem('bank_slips_queue')) || [];
    slips.push(order);
    localStorage.setItem('bank_slips_queue', JSON.stringify(slips));
    return true;
}

async function dbUpdateOrderStatus(orderId, status) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('bank_orders').update({ status }).eq('orderId', orderId);
            if (!error) return true;
            console.warn('Supabase update order status failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase update order status crash:', e);
        }
    }
    const slips = JSON.parse(localStorage.getItem('bank_slips_queue')) || [];
    const idx = slips.findIndex(s => s.orderId === orderId);
    if (idx !== -1) {
        slips[idx].status = status;
        localStorage.setItem('bank_slips_queue', JSON.stringify(slips));
    }
    return true;
}

// ==================== PAYOUT REQUESTS ====================
async function dbGetPayouts() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('payout_requests').select('*');
            if (!error && data) return data;
            console.warn('Supabase query failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase get payouts crash:', e);
        }
    }
    return JSON.parse(localStorage.getItem('payout_requests_queue')) || [];
}

async function dbAddPayout(payout) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('payout_requests').insert([payout]);
            if (!error) return true;
            console.warn('Supabase insert payout failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase add payout crash:', e);
        }
    }
    const payouts = JSON.parse(localStorage.getItem('payout_requests_queue')) || [];
    payouts.push(payout);
    localStorage.setItem('payout_requests_queue', JSON.stringify(payouts));
    return true;
}

async function dbUpdatePayoutStatus(id, status) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('payout_requests').update({ status }).eq('id', id);
            if (!error) return true;
            console.warn('Supabase update payout status failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase update payout status crash:', e);
        }
    }
    const payouts = JSON.parse(localStorage.getItem('payout_requests_queue')) || [];
    const idx = payouts.findIndex(p => p.id === id);
    if (idx !== -1) {
        payouts[idx].status = status;
        localStorage.setItem('payout_requests_queue', JSON.stringify(payouts));
    }
    return true;
}

// ==================== AFFILIATE STATS ====================
async function dbGetAffiliateStats(userSlug) {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('affiliate_stats').select('*').eq('user_slug', userSlug).single();
            if (!error && data) {
                return {
                    clicks: data.clicks,
                    sales: data.sales,
                    total_earnings: Number(data.total_earnings),
                    trend: {
                        Feb: Number(data.trend_feb),
                        Mar: Number(data.trend_mar),
                        Apr: Number(data.trend_apr),
                        May: Number(data.trend_may),
                        Jun: Number(data.trend_jun),
                        Jul: Number(data.trend_jul)
                    }
                };
            }
            
            // Seed stats globally if user is new
            if (error && error.code === 'PGRST116') { // PGRST116 means row not found
                let seedStats = { user_slug: userSlug, clicks: 0, sales: 0, total_earnings: 0, trend_feb: 0, trend_mar: 0, trend_apr: 0, trend_may: 0, trend_jun: 0, trend_jul: 0 };
                if (userSlug === 'affiliate' || userSlug === 'kasun_t') {
                    seedStats = { user_slug: userSlug, clicks: 1248, sales: 12, total_earnings: 23790, trend_feb: 4200, trend_mar: 8500, trend_apr: 12000, trend_may: 9800, trend_jun: 16500, trend_jul: 23790 };
                }
                await supabaseClient.from('affiliate_stats').insert([seedStats]);
                return {
                    clicks: seedStats.clicks,
                    sales: seedStats.sales,
                    total_earnings: seedStats.total_earnings,
                    trend: { Feb: seedStats.trend_feb, Mar: seedStats.trend_mar, Apr: seedStats.trend_apr, May: seedStats.trend_may, Jun: seedStats.trend_jun, Jul: seedStats.trend_jul }
                };
            }
            console.warn('Supabase query failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase get affiliate stats crash:', e);
        }
    }
    
    // LocalStorage fallback
    let stats = JSON.parse(localStorage.getItem('affiliate_stats_' + userSlug));
    if (!stats) {
        if (userSlug === 'affiliate' || userSlug === 'kasun_t') {
            stats = {
                clicks: 1248,
                sales: 12,
                total_earnings: 23790,
                trend: { Feb: 4200, Mar: 8500, Apr: 12000, May: 9800, Jun: 16500, Jul: 23790 }
            };
        } else {
            stats = {
                clicks: 0,
                sales: 0,
                total_earnings: 0,
                trend: { Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0 }
            };
        }
        localStorage.setItem('affiliate_stats_' + userSlug, JSON.stringify(stats));
    }
    return stats;
}

async function dbUpdateAffiliateStats(userSlug, stats) {
    if (supabaseClient) {
        try {
            const dbData = {
                clicks: stats.clicks,
                sales: stats.sales,
                total_earnings: stats.total_earnings,
                trend_feb: stats.trend.Feb,
                trend_mar: stats.trend.Mar,
                trend_apr: stats.trend.Apr,
                trend_may: stats.trend.May,
                trend_jun: stats.trend.Jun,
                trend_jul: stats.trend.Jul
            };
            const { error } = await supabaseClient.from('affiliate_stats').upsert({ user_slug: userSlug, ...dbData });
            if (!error) return true;
            console.warn('Supabase update stats failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase update affiliate stats crash:', e);
        }
    }
    localStorage.setItem('affiliate_stats_' + userSlug, JSON.stringify(stats));
    return true;
}

// ==================== BLOG ARTICLES ====================
async function dbGetBlogs() {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('blog_articles').select('*');
            if (!error && data) return data;
            console.warn('Supabase query failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase get blogs crash:', e);
        }
    }
    return JSON.parse(localStorage.getItem('hapanamy_blog_articles')) || [];
}

async function dbAddBlog(blog) {
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('blog_articles').insert([blog]);
            if (!error) return true;
            console.warn('Supabase insert blog failed, falling back to LocalStorage:', error);
        } catch (e) {
            console.error('Supabase add blog crash:', e);
        }
    }
    const blogs = JSON.parse(localStorage.getItem('hapanamy_blog_articles')) || [];
    blogs.push(blog);
    localStorage.setItem('hapanamy_blog_articles', JSON.stringify(blogs));
    return true;
}
