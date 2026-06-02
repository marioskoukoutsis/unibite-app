const pool = require('../config/db');

exports.createRequest = async (req, res) => {
    try {
        const { listing_id, consumer_id } = req.body;

        const [user] = await pool.query('SELECT credits FROM users WHERE id = ?', [consumer_id]);
        if (user[0].credits < 1) {
            return res.status(400).json({ error: 'Δεν έχεις αρκετούς πόντους.. Πρέπει να μοιραστείς κι εσύ φαγητό.' });
        }

        const [listing] = await pool.query('SELECT available_portions, cook_id FROM listings WHERE id = ?', [listing_id]);
        if (listing[0].cook_id === consumer_id) {
            return res.status(400).json({ error: 'Δεν μπορείς να κάνεις αίτημα για τη δική σου αγγελία.' });
        }
        if (listing[0].available_portions <= 0) {
            return res.status(400).json({ error: 'Δεν υπάρχουν διαθέσιμες μερίδες' });
        }

        const [existing] = await pool.query(
            `SELECT id FROM requests WHERE listing_id = ? AND consumer_id = ? AND status IN ('pending', 'approved')`,
            [listing_id, consumer_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Έχεις ήδη κάνει αίτημα για αυτή την αγγελία.' });
        }

        await pool.query(
            'INSERT INTO requests (listing_id, consumer_id, status) VALUES (?, ?, ?)',
            [listing_id, consumer_id, 'pending']
        );

        res.status(201).json({ message: 'Το αίτημα στάλθηκε επιτυχώς!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την αποστολή του αιτήματος.' });
    }
};

exports.updateRequestStatus = async (req, res) => {
    try {
        const requestId = req.params.id;
        const { status } = req.body;

        const [requests] = await pool.query(`
            SELECT r.*, l.cook_id, l.pickup_time
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            WHERE r.id = ?
        `, [requestId]);
        if (requests.length === 0) {
            return res.status(404).json({ error: 'Το αίτημα δεν βρέθηκε.' });
        }

        const request = requests[0];

        if (status === 'picked_up' || status === 'no_show') {
            if (new Date() < new Date(request.pickup_time)) {
                return res.status(400).json({ error: 'Δεν μπορείς να ορίσεις την κατάσταση παραλαβής πριν την ώρα παραλαβής.' });
            }
        }

        await pool.query('UPDATE requests SET status = ? WHERE id = ?', [status, requestId]);

        if (status === 'picked_up') {
            await pool.query('UPDATE users SET credits = credits + 1 WHERE id = ?', [request.cook_id]);
        }

        if (status === 'approved') {
            const [listing] = await pool.query('SELECT available_portions FROM listings WHERE id = ?', [request.listing_id]);
            if (listing[0].available_portions <= 0) {
                return res.status(400).json({ error: 'Δεν υπάρχουν πλέον διαθέσιμες μερίδες.' });
            }
            await pool.query('UPDATE listings SET available_portions = available_portions - 1 WHERE id = ?', [request.listing_id]);
        }

        if (status === 'no_show') {
            await pool.query('UPDATE users SET credits = credits - 1 WHERE id = ?', [request.consumer_id]);
            await pool.query('UPDATE listings SET available_portions = available_portions + 1 WHERE id = ?', [request.listing_id]);
        }

        res.json({ message: `Η κατάσταση του αιτήματος άλλαξε σε: ${status}` });
    } catch (error) {
        console.error('Σφάλμα στο updateRequestStatus:', error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ενημέρωση του αιτήματος.' });
    }
};

exports.getRequestsForCook = async (req, res) => {
    try {
        const cook_id = req.query.cook_id;
        const consumer_id = req.query.consumer_id;
        let query = '';
        let params = [];

        if (cook_id) {
            query = `
                SELECT r.id, r.status, r.created_at, r.listing_id, r.rating,
                       l.title AS listing_title, l.pickup_location, l.pickup_time,
                       u.name AS consumer_name, u.id AS consumer_id
                FROM requests r
                JOIN listings l ON r.listing_id = l.id
                JOIN users u ON r.consumer_id = u.id
                WHERE l.cook_id = ?
                ORDER BY r.created_at DESC
            `;
            params = [cook_id];
        } else if (consumer_id) {
            query = `
                SELECT r.id, r.status, r.created_at, r.rating, 
                       l.title AS listing_title, l.pickup_location, l.pickup_time,
                       u.name AS cook_name 
                FROM requests r
                JOIN listings l ON r.listing_id = l.id
                JOIN users u ON l.cook_id = u.id
                WHERE r.consumer_id = ?
                ORDER BY r.created_at DESC
            `;
            params = [consumer_id];
        } else {
            return res.status(400).json({ error: 'Πρέπει να δώσεις cook_id ή consumer_id στο URL.' });
        }

        const [requests] = await pool.query(query, params);
        res.json(requests);

    } catch (error) {
        console.error('Σφάλμα στο getRequests:', error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη λήψη των αιτημάτων.' });
    }
};

exports.rateRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const { rating } = req.body;

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Η βαθμολογία πρέπει να είναι μεταξύ 1 και 5.' });
        }

        const [requests] = await pool.query(`
            SELECT r.*, l.cook_id 
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            WHERE r.id = ?
        `, [requestId]);

        if (requests.length === 0) return res.status(404).json({ error: 'Το αίτημα δεν βρέθηκε.' });
        const request = requests[0];

        if (request.status !== 'picked_up') {
            return res.status(400).json({ error: 'Μπορείς να βαθμολογήσεις μόνο μετά την παραλαβή.' });
        }
        if (request.rating !== null) {
            return res.status(400).json({ error: 'Έχεις ήδη βαθμολογήσει αυτό το αίτημα.' });
        }

        await pool.query('UPDATE requests SET rating = ? WHERE id = ?', [rating, requestId]);

        if (rating >= 4) {
            await pool.query('UPDATE users SET credits = credits + 1 WHERE id = ?', [request.cook_id]);
        }

        res.json({ message: 'Η βαθμολογία καταχωρήθηκε επιτυχώς.' });
    } catch (error) {
        console.error('Σφάλμα στο rateRequest:', error);
        res.status(500).json({ error: 'Πρόβλημα κατά την αποθήκευση της βαθμολογίας.' });
    }
};