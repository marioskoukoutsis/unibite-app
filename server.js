const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path'); // για σταθερά paths όπου κι αν τρέχει ο server

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Μεγάλο όριο payload γιατί οι φωτογραφίες έρχονται ως base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Σερβίρουμε το frontend από τον φάκελο public
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const listingRoutes = require('./routes/listingRoutes');
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { startPenaltyScheduler } = require('./penaltyScheduler');

// Σύνδεση κάθε route group στο API path του
app.use('/api/listings', listingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);

app.get('/', (req, res) => {
    res.send('Καλώς ήρθες στο API του UniBite! Ο Server λειτουργεί.');
});

app.listen(PORT, () => {
    console.log(`🚀 Ο Server τρέχει στο http://localhost:${PORT}`);
    startPenaltyScheduler();
});