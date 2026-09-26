// ==============================================================================
// NEXUS PRIME (PVT) LTD — CATALOG SERVICE (PACKAGES & PRODUCTS)
// DOMAIN: nexusp.online
// ==============================================================================

const nexusDb = require('../db/nexus-db');

const NexusCatalogService = {
    // =========================================================================
    // MEMBERSHIP PACKAGES (PUBLIC & MEMBER)
    // =========================================================================

    /**
     * Retrieve all active membership packages for public display and member upgrade views.
     */
    async getActivePackages() {
        return await nexusDb.getAllPackages({ status: 'active' });
    },

    /**
     * Retrieve a package by slug or package_code
     */
    async getPackageBySlug(identifier) {
        if (!identifier) return null;
        let pkg = await nexusDb.getPackageBySlug(identifier);
        if (!pkg) {
            pkg = await nexusDb.getPackageByCode(identifier);
        }
        return pkg;
    },

    // =========================================================================
    // MEMBERSHIP PACKAGES (ADMIN MANAGEMENT)
    // =========================================================================

    /**
     * Retrieve packages for Admin with optional status and search filters
     */
    async getAdminPackages(options = {}) {
        return await nexusDb.getAllPackages(options);
    },

    /**
     * Create a new membership package with audit logging
     */
    async createPackage(payload, adminContext = {}) {
        if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 3) {
            throw new Error('Package name is required (minimum 3 characters).');
        }

        if (!payload.package_code || typeof payload.package_code !== 'string' || payload.package_code.trim().length < 2) {
            throw new Error('Package code is required (e.g. NP-PKG-01).');
        }

        const normalizedCode = payload.package_code.trim().toUpperCase();
        const existingCode = await nexusDb.getPackageByCode(normalizedCode);
        if (existingCode) {
            throw new Error(`Package code '${normalizedCode}' already exists.`);
        }

        const slug = (payload.slug || payload.name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const existingSlug = await nexusDb.getPackageBySlug(slug);
        if (existingSlug) {
            throw new Error(`Package slug '${slug}' already exists.`);
        }

        const price = parseFloat(payload.price);
        if (isNaN(price) || price < 0) {
            throw new Error('Price must be a valid non-negative number.');
        }

        const validStatuses = ['draft', 'active', 'inactive', 'archived'];
        const status = payload.status && validStatuses.includes(payload.status) ? payload.status : 'draft';

        const packageData = {
            name: payload.name.trim(),
            package_code: normalizedCode,
            slug,
            short_description: payload.short_description || '',
            full_description: payload.full_description || '',
            price,
            currency: (payload.currency || 'LKR').trim().toUpperCase(),
            status,
            display_order: parseInt(payload.display_order, 10) || 99,
            featured: !!payload.featured,
            image_icon: payload.image_icon || 'fas fa-box',
            features: Array.isArray(payload.features) ? payload.features : [],
            product_ids: Array.isArray(payload.product_ids) ? payload.product_ids : []
        };

        const createdPkg = await nexusDb.insertPackage(packageData);

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PACKAGE_CREATED',
            entity_type: 'PACKAGE',
            entity_id: createdPkg.id,
            old_values: null,
            new_values: createdPkg,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            package: createdPkg
        };
    },

    /**
     * Update an existing membership package with audit logging
     */
    async updatePackage(id, payload, adminContext = {}) {
        const existing = await nexusDb.getPackageById(id);
        if (!existing) {
            throw new Error(`Package not found for ID '${id}'.`);
        }

        const updates = {};

        if (payload.name !== undefined) {
            if (typeof payload.name !== 'string' || payload.name.trim().length < 3) {
                throw new Error('Package name must be at least 3 characters.');
            }
            updates.name = payload.name.trim();
        }

        if (payload.package_code !== undefined) {
            const normalizedCode = payload.package_code.trim().toUpperCase();
            if (normalizedCode !== existing.package_code) {
                const dupCode = await nexusDb.getPackageByCode(normalizedCode);
                if (dupCode && dupCode.id !== id) {
                    throw new Error(`Package code '${normalizedCode}' already in use.`);
                }
            }
            updates.package_code = normalizedCode;
        }

        if (payload.slug !== undefined) {
            const normalizedSlug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (normalizedSlug !== existing.slug) {
                const dupSlug = await nexusDb.getPackageBySlug(normalizedSlug);
                if (dupSlug && dupSlug.id !== id) {
                    throw new Error(`Package slug '${normalizedSlug}' already in use.`);
                }
            }
            updates.slug = normalizedSlug;
        }

        if (payload.price !== undefined) {
            const price = parseFloat(payload.price);
            if (isNaN(price) || price < 0) {
                throw new Error('Price must be a valid non-negative number.');
            }
            updates.price = price;
        }

        if (payload.currency !== undefined) updates.currency = payload.currency.trim().toUpperCase();
        if (payload.short_description !== undefined) updates.short_description = payload.short_description;
        if (payload.full_description !== undefined) updates.full_description = payload.full_description;
        if (payload.display_order !== undefined) updates.display_order = parseInt(payload.display_order, 10);
        if (payload.featured !== undefined) updates.featured = !!payload.featured;
        if (payload.image_icon !== undefined) updates.image_icon = payload.image_icon;
        if (payload.status !== undefined) {
            const validStatuses = ['draft', 'active', 'inactive', 'archived'];
            if (!validStatuses.includes(payload.status)) {
                throw new Error(`Invalid status '${payload.status}'. Allowed: ${validStatuses.join(', ')}`);
            }
            updates.status = payload.status;
        }
        if (Array.isArray(payload.features)) updates.features = payload.features;
        if (Array.isArray(payload.product_ids)) updates.product_ids = payload.product_ids;

        const updatedPkg = await nexusDb.updatePackage(id, updates);

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PACKAGE_UPDATED',
            entity_type: 'PACKAGE',
            entity_id: id,
            old_values: existing,
            new_values: updatedPkg,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            package: updatedPkg
        };
    },

    /**
     * Update package status with audit logging
     */
    async setPackageStatus(id, newStatus, adminContext = {}) {
        const validStatuses = ['draft', 'active', 'inactive', 'archived'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid package status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
        }

        const existing = await nexusDb.getPackageById(id);
        if (!existing) {
            throw new Error(`Package not found for ID '${id}'.`);
        }

        const updatedPkg = await nexusDb.updatePackage(id, { status: newStatus });

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PACKAGE_STATUS_CHANGED',
            entity_type: 'PACKAGE',
            entity_id: id,
            old_values: { status: existing.status },
            new_values: { status: newStatus },
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            package: updatedPkg
        };
    },

    // =========================================================================
    // PRODUCT CATEGORIES
    // =========================================================================

    /**
     * Retrieve active product categories for public display
     */
    async getActiveCategories() {
        return await nexusDb.getAllCategories({ status: 'active' });
    },

    /**
     * Retrieve all categories for Admin
     */
    async getAdminCategories(options = {}) {
        return await nexusDb.getAllCategories(options);
    },

    /**
     * Create product category with audit logging
     */
    async createCategory(payload, adminContext = {}) {
        if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
            throw new Error('Category name is required.');
        }

        const slug = (payload.slug || payload.name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const existing = await nexusDb.getCategoryBySlug(slug);
        if (existing) {
            throw new Error(`Category slug '${slug}' already exists.`);
        }

        const cat = await nexusDb.insertCategory({
            name: payload.name.trim(),
            slug,
            description: payload.description || '',
            status: payload.status || 'active',
            display_order: parseInt(payload.display_order, 10) || 1
        });

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'CATEGORY_CREATED',
            entity_type: 'CATEGORY',
            entity_id: cat.id,
            old_values: null,
            new_values: cat,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            category: cat
        };
    },

    /**
     * Update product category with audit logging
     */
    async updateCategory(id, payload, adminContext = {}) {
        const existing = await nexusDb.getCategoryById(id);
        if (!existing) {
            throw new Error(`Category not found for ID '${id}'.`);
        }

        const updates = {};
        if (payload.name !== undefined) updates.name = payload.name.trim();
        if (payload.slug !== undefined) {
            const slug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (slug !== existing.slug) {
                const dup = await nexusDb.getCategoryBySlug(slug);
                if (dup && dup.id !== id) {
                    throw new Error(`Category slug '${slug}' already exists.`);
                }
            }
            updates.slug = slug;
        }
        if (payload.description !== undefined) updates.description = payload.description.trim();
        if (payload.status !== undefined) updates.status = payload.status;
        if (payload.display_order !== undefined) updates.display_order = parseInt(payload.display_order, 10);

        const updatedCat = await nexusDb.updateCategory(id, updates);

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'CATEGORY_UPDATED',
            entity_type: 'CATEGORY',
            entity_id: id,
            old_values: existing,
            new_values: updatedCat,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            category: updatedCat
        };
    },

    // =========================================================================
    // PRODUCTS (PUBLIC & ADMIN)
    // =========================================================================

    /**
     * Retrieve active products for public catalog showcase
     */
    async getActiveProducts(options = {}) {
        return await nexusDb.getAllProducts({
            ...options,
            status: 'active'
        });
    },

    /**
     * Retrieve product by slug for public detail showcase
     */
    async getProductBySlug(slug) {
        if (!slug) return null;
        return await nexusDb.getProductBySlug(slug);
    },

    /**
     * Retrieve products for Admin with pagination, category filter, and search
     */
    async getAdminProducts(options = {}) {
        return await nexusDb.getAllProducts(options);
    },

    /**
     * Create product with SKU and slug uniqueness enforcement + audit log
     */
    async createProduct(payload, adminContext = {}) {
        if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
            throw new Error('Product name is required (minimum 2 characters).');
        }

        if (!payload.sku || typeof payload.sku !== 'string' || payload.sku.trim().length < 2) {
            throw new Error('Product SKU is required (e.g. NP-SKU-01).');
        }

        const sku = payload.sku.trim().toUpperCase();
        const existingSku = await nexusDb.getProductBySku(sku);
        if (existingSku) {
            throw new Error(`Product SKU '${sku}' already exists.`);
        }

        const slug = (payload.slug || payload.name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const existingSlug = await nexusDb.getProductBySlug(slug);
        if (existingSlug) {
            throw new Error(`Product slug '${slug}' already exists.`);
        }

        const price = parseFloat(payload.price);
        if (isNaN(price) || price < 0) {
            throw new Error('Price must be a valid non-negative number.');
        }

        const stock = parseInt(payload.stock_quantity, 10);
        if (payload.stock_quantity !== undefined && (isNaN(stock) || stock < 0)) {
            throw new Error('Stock quantity must be a non-negative integer.');
        }

        const validStatuses = ['draft', 'active', 'inactive', 'archived', 'out_of_stock'];
        const status = payload.status && validStatuses.includes(payload.status) ? payload.status : 'active';

        const productData = {
            name: payload.name.trim(),
            sku,
            slug,
            category_id: payload.category_id || null,
            short_description: payload.short_description || '',
            full_description: payload.full_description || '',
            price,
            currency: (payload.currency || 'LKR').trim().toUpperCase(),
            stock_quantity: isNaN(stock) ? 9999 : stock,
            status,
            featured: !!payload.featured,
            image_url: payload.image_url || 'assets/nexus/images/product-default.png',
            display_order: parseInt(payload.display_order, 10) || 99
        };

        const createdProd = await nexusDb.insertProduct(productData);

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PRODUCT_CREATED',
            entity_type: 'PRODUCT',
            entity_id: createdProd.id,
            old_values: null,
            new_values: createdProd,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            product: createdProd
        };
    },

    /**
     * Update product with audit logging
     */
    async updateProduct(id, payload, adminContext = {}) {
        const existing = await nexusDb.getProductById(id);
        if (!existing) {
            throw new Error(`Product not found for ID '${id}'.`);
        }

        const updates = {};

        if (payload.name !== undefined) {
            if (typeof payload.name !== 'string' || payload.name.trim().length < 2) {
                throw new Error('Product name must be at least 2 characters.');
            }
            updates.name = payload.name.trim();
        }

        if (payload.sku !== undefined) {
            const sku = payload.sku.trim().toUpperCase();
            if (sku !== existing.sku) {
                const dup = await nexusDb.getProductBySku(sku);
                if (dup && dup.id !== id) {
                    throw new Error(`Product SKU '${sku}' already exists.`);
                }
            }
            updates.sku = sku;
        }

        if (payload.slug !== undefined) {
            const slug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (slug !== existing.slug) {
                const dup = await nexusDb.getProductBySlug(slug);
                if (dup && dup.id !== id) {
                    throw new Error(`Product slug '${slug}' already exists.`);
                }
            }
            updates.slug = slug;
        }

        if (payload.price !== undefined) {
            const price = parseFloat(payload.price);
            if (isNaN(price) || price < 0) {
                throw new Error('Price must be a valid non-negative number.');
            }
            updates.price = price;
        }

        if (payload.stock_quantity !== undefined) {
            const stock = parseInt(payload.stock_quantity, 10);
            if (isNaN(stock) || stock < 0) {
                throw new Error('Stock quantity must be a non-negative integer.');
            }
            updates.stock_quantity = stock;
        }

        if (payload.category_id !== undefined) updates.category_id = payload.category_id;
        if (payload.short_description !== undefined) updates.short_description = payload.short_description;
        if (payload.full_description !== undefined) updates.full_description = payload.full_description;
        if (payload.currency !== undefined) updates.currency = payload.currency.trim().toUpperCase();
        if (payload.featured !== undefined) updates.featured = !!payload.featured;
        if (payload.image_url !== undefined) updates.image_url = payload.image_url;
        if (payload.display_order !== undefined) updates.display_order = parseInt(payload.display_order, 10);
        if (payload.status !== undefined) {
            const validStatuses = ['draft', 'active', 'inactive', 'archived', 'out_of_stock'];
            if (!validStatuses.includes(payload.status)) {
                throw new Error(`Invalid status '${payload.status}'. Allowed: ${validStatuses.join(', ')}`);
            }
            updates.status = payload.status;
        }

        const updatedProd = await nexusDb.updateProduct(id, updates);

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PRODUCT_UPDATED',
            entity_type: 'PRODUCT',
            entity_id: id,
            old_values: existing,
            new_values: updatedProd,
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            product: updatedProd
        };
    },

    /**
     * Update product status with audit logging
     */
    async setProductStatus(id, newStatus, adminContext = {}) {
        const validStatuses = ['draft', 'active', 'inactive', 'archived', 'out_of_stock'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid product status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
        }

        const existing = await nexusDb.getProductById(id);
        if (!existing) {
            throw new Error(`Product not found for ID '${id}'.`);
        }

        const updatedProd = await nexusDb.updateProduct(id, { status: newStatus });

        // Audit Log
        await nexusDb.insertAuditLog({
            user_id: adminContext.userId || 'admin-root',
            action: 'PRODUCT_STATUS_CHANGED',
            entity_type: 'PRODUCT',
            entity_id: id,
            old_values: { status: existing.status },
            new_values: { status: newStatus },
            ip_address: adminContext.ip || '127.0.0.1',
            user_agent: adminContext.userAgent || 'Nexus Admin Panel'
        });

        return {
            success: true,
            product: updatedProd
        };
    }
};

module.exports = NexusCatalogService;
