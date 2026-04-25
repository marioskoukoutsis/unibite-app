const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Ρυθμίσεις σύνδεσης με τη MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'mariosk',
    password: '27112008Marilia!',
    database: 'unibite_db'
});

// Δοκιμαστικό Endpoint για να δούμε αν βλέπει τη βάση
app.get('/api/users', async (req, res) => {
    try {
        // Κάνουμε ένα απλό ερώτημα (query)
        const [rows] = await pool.query('SELECT * FROM users');
        res.json(rows); // Στέλνουμε τα αποτελέσματα στο Frontend σε μορφή JSON
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα με τη βάση δεδομένων' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Ο Server τρέχει στο http://localhost:${PORT}`);
    console.log(`🗄️ Αναμονή για σύνδεση με τη MySQL...`);
});