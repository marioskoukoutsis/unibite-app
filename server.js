require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ρυθμίσεις σύνδεσης με τη MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
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

// Endpoint: Λήψη όλων των ενεργών αγγελιών για το Feed
app.get('/api/listings', async (req, res) => {
    try {
        // Τραβάμε μόνο τις αγγελίες που είναι 'active'
        const [listings] = await pool.query("SELECT * FROM listings WHERE status = 'active'");

        // Στέλνουμε τις αγγελίες πίσω σε μορφή JSON
        res.json(listings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη λήψη των αγγελιών' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Ο Server τρέχει στο http://localhost:${PORT}`);
    console.log(`🗄️ Αναμονή για σύνδεση με τη MySQL...`);
});