// Hapanamy.lk Member Support & Helpdesk Ticket Service (STEP 12)
// Manages support tickets, status lifecycles (OPEN, IN_PROGRESS, RESOLVED, CLOSED),
// priority levels (LOW, MEDIUM, HIGH, URGENT), and communication history.

const crypto = require('crypto');

const TICKET_STATUSES = {
    OPEN: 'OPEN',
    IN_PROGRESS: 'IN_PROGRESS',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED'
};

const SupportService = {
    ticketStore: [],
    faqStore: [
        {
            id: 'faq-1',
            question: 'How do I activate my purchased course?',
            answer: 'After uploading your bank transfer slip, our finance team verifies the transaction within 1-2 hours. Once approved, your course will be automatically unlocked in your Student Dashboard.'
        },
        {
            id: 'faq-2',
            question: 'What are the requirements to qualify for 7-Tier Upline commissions?',
            answer: 'You must have at least 1 directly sponsored Active member in your Left leg and 1 in your Right leg, along with an Approved KYC document.'
        },
        {
            id: 'faq-3',
            question: 'What is the minimum bank withdrawal limit?',
            answer: 'The minimum withdrawal limit is Rs. 1,000.00. Withdrawals are processed to verified Sri Lankan commercial bank accounts.'
        }
    ],

    /**
     * Creates a new support ticket.
     */
    createTicket({ userId, category, subject, message, priority = 'MEDIUM' }) {
        if (!userId || !subject || !message) {
            return { success: false, error: 'User ID, subject, and message are required.' };
        }

        const ticket = {
            id: 'tkt-' + crypto.randomBytes(6).toString('hex'),
            user_id: userId,
            category: category || 'GENERAL_INQUIRY',
            subject: subject.trim(),
            status: TICKET_STATUSES.OPEN,
            priority: priority.toUpperCase(),
            messages: [
                {
                    sender_id: userId,
                    sender_role: 'member',
                    message: message.trim(),
                    created_at: new Date().toISOString()
                }
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this.ticketStore.push(ticket);
        return { success: true, ticket };
    },

    /**
     * Retrieves tickets for a specific user.
     */
    getUserTickets(userId) {
        return this.ticketStore.filter(t => t.user_id === userId);
    },

    /**
     * Appends a message or response to a ticket.
     */
    replyTicket(ticketId, senderId, senderRole, message) {
        const ticket = this.ticketStore.find(t => t.id === ticketId);
        if (!ticket) return { success: false, error: 'Ticket not found.' };

        ticket.messages.push({
            sender_id: senderId,
            sender_role: senderRole,
            message: message.trim(),
            created_at: new Date().toISOString()
        });

        if (senderRole === 'admin') {
            ticket.status = TICKET_STATUSES.IN_PROGRESS;
        }
        ticket.updated_at = new Date().toISOString();

        return { success: true, ticket };
    },

    /**
     * Resolves or closes a ticket.
     */
    updateStatus(ticketId, newStatus, adminId) {
        const ticket = this.ticketStore.find(t => t.id === ticketId);
        if (!ticket) return { success: false, error: 'Ticket not found.' };

        ticket.status = newStatus;
        ticket.updated_at = new Date().toISOString();
        ticket.closed_by = adminId;

        return { success: true, ticket };
    }
};

if (typeof module !== 'undefined') {
    module.exports = SupportService;
}
