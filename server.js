const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path'); // Το προσθέτουμε για σιγουριά στα μονοπάτια

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// --- 1. Μεγαλώνουμε το όριο για τις φωτογραφίες ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 2. ΕΠΙΤΡΕΠΟΥΜΕ ΣΤΟΝ BROWSER ΝΑ ΒΛΕΠΕΙ ΤΟΝ ΦΑΚΕΛΟ PUBLIC ---
// Χρησιμοποιούμε το path.join για να είμαστε σίγουροι ότι βρίσκει τον φάκελο ανεξάρτητα από πού τρέχεις το terminal
app.use(express.static(path.join(__dirname, 'public')));

// Εισαγωγή των Routes
const listingRoutes = require('./routes/listingRoutes');
const authRoutes = require('./routes/authRoutes');
const requestRoutes = require('./routes/requestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { startPenaltyScheduler } = require('./penaltyScheduler');

// Χρήση των Routes
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