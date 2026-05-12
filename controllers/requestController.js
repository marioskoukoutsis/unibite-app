const pool = require('../config/db');

exports.createRequest = async (req, res) => {
    try {
        const { listing_id, consumer_id } = req.body;

        // Έλεγχος πόντων (Credits) - Απαίτηση Γ2
        const [user] = await pool.query('SELECT credits FROM users WHERE id = ?', [consumer_id]);
        if (user[0].credits < 1) {
            return res.status(400).json({ error: 'Δεν έχεις αρκετούς πόντους.. Πρέπει να μοιραστείς κι εσύ φαγητό.' });
        }

        // Έλεγχος διαθεσιμότητας μερίδων
        const [listing] = await pool.query('SELECT available_portions FROM listings WHERE id = ?', [listing_id]);
        if (listing[0].available_portions <= 0) {
            return res.status(400).json({ error: 'Δεν υπάρχουν διαθέσιμες μερίδες' });
        }

        // Δημιουργία αιτήματος με status 'pending'
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
