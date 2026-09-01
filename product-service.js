// Hapanamy.lk Product & Bank Deposit Payment Domain Service
// Handles product definitions, deposit verification checks, and triggers commission events

const ProductService = {
    // Event listener array to support decoupling the commission engine in Phase 10
    eventListeners: [],

    /**
     * Registers a listener callback for purchase events.
     */
    onPurchaseActivated(callback) {
        this.eventListeners.push(callback);
    },

    /**
     * Triggers registered commission and binary matching events when a purchase is activated.
     */
    triggerPurchaseActivation(purchaseRecord) {
        console.log(`📡 Event triggered: Purchase activated for user ${purchaseRecord.user_id}, product ${purchaseRecord.product_id}`);
        this.eventListeners.forEach(listener => {
            try {
                listener(purchaseRecord);
            } catch (err) {
                console.error('Error in purchase activation listener:', err);
            }
        });
    },

    /**
     * Checks if a deposit payload has all required manual bank details.
     */
    isValidDeposit(payload) {
        const { purchaseId, bankReference, amount, slipUrl } = payload;
        return !!(purchaseId && bankReference && amount && slipUrl);
    }
};

if (typeof module !== 'undefined') {
    module.exports = ProductService;
}
