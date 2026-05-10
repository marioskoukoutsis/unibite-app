const pool = require('../config/db');

// --- ΕΓΓΡΑΦΗ (REGISTER) ---
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Παρακαλώ συμπληρώστε όλα τα πεδία.' });
        }

        // Ελέγχουμε αν υπάρχει ήδη χρήστης με αυτό το email
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Αυτό το email χρησιμοποιείται ήδη.' });
        }

        // Δημιουργία του χρήστη (παίρνει αυτόματα 5 credits βάσει του SQL schema)
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, password, 'student']
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

// --- ΣΥΝΔΕΣΗ (LOGIN) ---
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Λείπει email ή κωδικός.' });
        }

        // Ψάχνουμε τον χρήστη με αυτό το email και κωδικό
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Λάθος email ή κωδικός.' });
        }

        const user = users[0];

        // Στέλνουμε πίσω τα στοιχεία του (χωρίς τον κωδικό)
        res.json({
            message: 'Επιτυχής σύνδεση!',
            user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη σύνδεση.' });
    }
};