const pool = require('../config/db');

// --- ΥΠΑΡΧΟΝ: Στατιστικά Μήνα ---
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

// =============================================
//  ΝΕΑ: Interactive Admin Endpoints
// =============================================

// --- Λίστα Χρηστών ---
exports.getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT id, name, email, role, credits, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Σφάλμα getUsers:', error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη χρηστών.' });
    }
};

// --- Αλλαγή Role Χρήστη ---
exports.updateUserRole = async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        if (!['student', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Μη έγκυρος ρόλος. Επιτρέπονται: student, admin.' });
        }

        const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
        }

        res.json({ message: `Ο ρόλος ενημερώθηκε σε: ${role}` });
    } catch (error) {
        console.error('Σφάλμα updateUserRole:', error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ενημέρωση ρόλου.' });
    }
};

// --- Διαγραφή Χρήστη ---
exports.deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Ο χρήστης δεν βρέθηκε.' });
        }

        res.json({ message: 'Ο χρήστης διαγράφηκε επιτυχώς.' });
    } catch (error) {
        console.error('Σφάλμα deleteUser:', error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη διαγραφή χρήστη.' });
    }
};

// --- Λίστα Όλων των Αγγελιών (ενεργές + ανενεργές + διαγραμμένες) ---
exports.getAllListings = async (req, res) => {
    try {
        const [listings] = await pool.query(`
            SELECT l.*, u.name AS cook_name
            FROM listings l
            JOIN users u ON l.cook_id = u.id
            ORDER BY l.created_at DESC
        `);
        res.json(listings);
    } catch (error) {
        console.error('Σφάλμα getAllListings:', error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη αγγελιών.' });
    }
};

// --- Διαγραφή Αγγελίας (Admin) ---
exports.deleteListing = async (req, res) => {
    try {
        const listingId = req.params.id;

        const [result] = await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = ?`, [listingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        // Απορρίπτουμε και τα εκκρεμή αιτήματα
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

// --- Πρόσφατα Αιτήματα (48 ώρες) ---
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