const pool = require('../config/db');
const bcrypt = require('bcrypt'); // hashing κωδικών

// Εγγραφή νέου χρήστη
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Παρακαλώ συμπληρώστε όλα τα πεδία.' });
        }

        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Αυτό το email χρησιμοποιείται ήδη.' });
        }

        // ποτέ δεν αποθηκεύουμε τον κωδικό σε plain text — μόνο το hash
       const hashedPassword = await bcrypt.hash(password, parseInt(process.env.HASH_LEVEL));

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'student']
        );

        res.status(201).json({
            message: 'Η εγγραφή ήταν επιτυχής!',
            user: { id: result.insertId, name, email, role: 'student' }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την εγγραφή.' });
    }
};

// Σύνδεση χρήστη
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Λείπει email ή κωδικός.' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Λάθος email ή κωδικός.' });
        }

        const user = users[0];

        // σύγκριση plain κωδικού με το hash της βάσης
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Λάθος email ή κωδικός.' });
        }

        // επιστρέφουμε τα στοιχεία χωρίς τον κωδικό
        res.json({
            message: 'Επιτυχής σύνδεση!',
            user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη σύνδεση.' });
    }
};

// Στοιχεία ενός χρήστη
exports.getUser = async (req, res) => {
    try {
        const [users] = await pool.query('SELECT id, name, email, role, credits FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε.' });
        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ανάκτηση χρήστη.' });
    }
};

// Ενημέρωση στοιχείων λογαριασμού
exports.updateAccount = async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email, password } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Παρακαλώ συμπληρώστε όνομα και email.' });
        }

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Αυτό το email χρησιμοποιείται ήδη από άλλον.' });
        }

        if (password) {
            // δόθηκε νέος κωδικός → hash και ενημέρωση
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.query(
                'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
                [name, email, hashedPassword, userId]
            );
        } else {
            // κενός κωδικός → κρατάμε τον υπάρχοντα, αλλάζουμε μόνο όνομα/email
            await pool.query(
                'UPDATE users SET name = ?, email = ? WHERE id = ?',
                [name, email, userId]
            );
        }

        const [users] = await pool.query('SELECT id, name, email, role, credits FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Τα στοιχεία σου ενημερώθηκαν!', user: users[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ενημέρωση.' });
    }
};