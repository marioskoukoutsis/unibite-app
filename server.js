const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Εισαγωγή των Routes
const listingRoutes = require('./routes/listingRoutes');
const authRoutes = require('./routes/authRoutes');

// Χρήση των Routes
app.use('/api/listings', listingRoutes); // Όλα τα αιτήματα στο /api/listings πάνε στο listingRoutes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('Καλώς ήρθες στο API του UniBite! Ο Server λειτουργεί.');
});

app.listen(PORT, () => {
    console.log(`🚀 Ο Server τρέχει στο http://localhost:${PORT}`);
});