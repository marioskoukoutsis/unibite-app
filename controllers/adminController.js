const pool = require('../config/db');

// Στατιστικά μήνα για το admin dashboard
exports.getStats = async (req, res) => {
    try {
        const [[portionsResult]] = await pool.query(`
            SELECT COUNT(*) AS total_portions 
            FROM requests 
            WHERE status = 'picked_up' AND created_at >= NOW() - INTERVAL 1 MONTH
        `);

        const [[topDonorResult]] = await pool.query(`
            SELECT u.name, COUNT(r.id) AS portions_given
            FROM users u
            JOIN listings l ON u.id = l.cook_id
            JOIN requests r ON l.id = r.listing_id
            WHERE r.status = 'picked_up'
            GROUP BY u.id
            ORDER BY portions_given DESC
            LIMIT 1
        `);

        const [topMeals] = await pool.query(`
            SELECT l.title, AVG(r.rating) AS avg_rating
            FROM listings l
            JOIN requests r ON l.id = r.listing_id
            WHERE r.rating IS NOT NULL AND r.rating > 0
            GROUP BY l.id
            ORDER BY avg_rating DESC
            LIMIT 3
        `);

        res.json({
            totalPortions: portionsResult.total_portions || 0,
            topDonor: topDonorResult || { name: 'Κανένας ακόμα', portions_given: 0 },
            topMeals: topMeals
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη στατιστικών.' });
    }
};



// Όλες οι αγγελίες (ενεργές, ανενεργές, διαγραμμένες)
exports.getAllListings = async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT l.*, u.name AS cook_name
            FROM listings l
            JOIN users u ON l.cook_id = u.id
            ORDER BY l.created_at DESC
        `);

        // Υπολογίζουμε την πραγματική κατάσταση: >48h → διεγραμμένη, 0 μερίδες → ανενεργή
        const EXPIRY_MS = 48 * 60 * 60 * 1000;
        const now = Date.now();
        listings.forEach(l => {
            if (l.status === 'deleted') return; // χειροκίνητη διαγραφή — μένει ως έχει
            if (now - new Date(l.created_at).getTime() > EXPIRY_MS) {
                l.status = 'deleted';
            } else if (l.available_portions <= 0) {
                l.status = 'inactive';
            }
        });

        res.json(listings);
    } catch (error) {
        console.error('Σφάλμα getAllListings:', error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη αγγελιών.' });
    }
};

// Διαγραφή αγγελίας από admin (soft delete)
exports.deleteListing = async (req, res) => {
    try {
        const listingId = req.params.id;

        const [result] = await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = ?`, [listingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        // απόρριψη και των ανοιχτών αιτημάτων της
        await pool.query(
            `UPDATE requests SET status = 'rejected' WHERE listing_id = ? AND status IN ('pending', 'approved')`,
            [listingId]
        );

        res.json({ message: 'Η αγγελία διαγράφηκε από τον admin.' });
    } catch (error) {
        console.error('Σφάλμα deleteListing (admin):', error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη διαγραφή αγγελίας.' });
    }
};

// Τα 50 πιο πρόσφατα αιτήματα
exports.getRecentRequests = async (req, res) => {
    try {
        const [requests] = await pool.query(`
            SELECT r.id, r.status, r.rating, r.created_at,
                   l.title AS listing_title, l.pickup_location, l.pickup_time,
                   consumer.name AS consumer_name,
                   cook.name AS cook_name
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            JOIN users consumer ON r.consumer_id = consumer.id
            JOIN users cook ON l.cook_id = cook.id
            ORDER BY r.created_at DESC
            LIMIT 50
        `);
        res.json(requests);
    } catch (error) {
        console.error('Σφάλμα getRecentRequests:', error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη αιτημάτων.' });
    }
};