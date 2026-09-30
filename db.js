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
    if (!user) return false;
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
    const exists = users.some(u => 
        (user.email && u.email && u.email.toLowerCase() === user.email.toLowerCase()) ||
        (user.id && u.id && u.id === user.id) ||
        (user.username && u.username && u.username.toLowerCase() === user.username.toLowerCase())
    );
    if (!exists) {
        users.push(user);
        localStorage.setItem('hapanamy_registered_users', JSON.stringify(users));
    }
    return true;
}

async function dbUpdateUser(email, updates) {
    if (supabaseClient) {
        try {
            await supabaseClient.from('registered_users').update(updates).eq('email', email);
        } catch (e) {
            console.error('Supabase update user crash:', e);
        }
    }
    let users = JSON.parse(localStorage.getItem('hapanamy_registered_users')) || [];
    users = users.map(u => {
        if (u.email === email || (u.name && u.name === email)) {
            return { ...u, ...updates };
        }
        return u;
    });
    localStorage.setItem('hapanamy_registered_users', JSON.stringify(users));
    return true;
}

async function dbDeleteUser(email) {
    const cleanIdent = String(email || '').toLowerCase().trim();
    if (supabaseClient) {
        try {
            await supabaseClient.from('registered_users').delete().eq('email', email);
        } catch (e) {
            console.error('Supabase delete user crash:', e);
        }
    }

    // Backend server sync
    try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('active_token') || localStorage.getItem('admin_token') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch('/api/admin/members/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ memberId: email })
        });
    } catch (e) {
        console.warn('Backend delete sync exception:', e.message);
    }

    // Comprehensive client storage cleanup
    const allStores = ['hapanamy_registered_users', 'registered_users', 'all_members', 'hapanamy_users', 'all_users', 'users', 'bank_slips_queue', 'hapanamy_orders'];
    allStores.forEach(sk => {
        try {
            const raw = localStorage.getItem(sk);
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                    const filtered = list.filter(u => {
                        const uEmail = (u.email || u.user_email || '').toLowerCase().trim();
                        const uUname = (u.username || u.user_name || '').toLowerCase().replace(/^@+/, '').trim();
                        const uId = (u.id || u.user_id || '').toLowerCase().trim();
                        return !(uEmail === cleanIdent || uUname === cleanIdent || uId === cleanIdent || uEmail.includes(cleanIdent));
                    });
                    localStorage.setItem(sk, JSON.stringify(filtered));
                }
            }
        } catch (e) {}
    });

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('referred_users_')) {
            try {
                const list = JSON.parse(localStorage.getItem(k)) || [];
                if (Array.isArray(list)) {
                    const filtered = list.filter(u => {
                        const uEmail = (u.email || '').toLowerCase().trim();
                        const uUname = (u.username || '').toLowerCase().replace(/^@+/, '').trim();
                        const uId = (u.id || u.user_id || '').toLowerCase().trim();
                        return !(uEmail === cleanIdent || uUname === cleanIdent || uId === cleanIdent);
                    });
                    localStorage.setItem(k, JSON.stringify(filtered));
                }
            } catch (e) {}
        }
    }

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
    // 1. Authoritative Backend Server Sync
    try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('active_token') || '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch('/api/member/payments', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                productId: order.productId || order.product_id || order.course || 'titan-elite',
                orderNumber: order.orderId || order.order_id,
                bankReference: order.txnCode || order.bank_reference || ('REF-' + Date.now()),
                transferDate: order.date || new Date().toISOString().split('T')[0],
                amount: order.amount || 19900,
                slipUrl: order.slipUrl || order.slip_url || 'storage/private/slips/sample-slip.jpg',
                notes: order.notes || `Submitted by ${order.userName || order.email || 'Customer'}`
            })
        }).catch(() => {});
    } catch (apiErr) {
        console.warn('Server payment submission notice:', apiErr);
    }

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
                await supabaseClient.from('affiliate_stats').insert([seedStats]);
                return {
                    clicks: seedStats.clicks,
                    sales: seedStats.sales,
                    total_earnings: seedStats.total_earnings,
                    trend: { Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0 }
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
        stats = {
            clicks: 0,
            sales: 0,
            total_earnings: 0,
            trend: { Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0 }
        };
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
