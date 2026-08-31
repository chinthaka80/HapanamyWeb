// Hapanamy.lk Commission Engine Core
// Calculates direct referral commissions and binary matches

const CommissionCore = {
    /**
     * Calculates direct commission (Default 8%).
     */
    calculateDirectCommission(sellingPrice, ratePercent = 8) {
        // Use minor unit or decimal conversion safely
        const price = Math.round(sellingPrice * 100);
        const commission = Math.round(price * (ratePercent / 100));
        return commission / 100;
    },

    /**
     * Calculates binary matched commission (7% of matched LKR volume).
     */
    calculateBinaryMatching(leftVolume, rightVolume, ratePercent = 7) {
        const matched = Math.min(leftVolume, rightVolume);
        const matchedCents = Math.round(matched * 100);
        const commission = Math.round(matchedCents * (ratePercent / 100));
        return {
            matchedVolume: matched,
            commission: commission / 100,
            leftCarryForward: leftVolume - matched,
            rightCarryForward: rightVolume - matched
        };
    }
};

if (typeof module !== 'undefined') {
    module.exports = CommissionCore;
}
