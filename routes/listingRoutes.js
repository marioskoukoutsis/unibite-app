const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController'); // Φέρνουμε τον controller

// Ορίζουμε τις διαδρομές. (Το '/api/listings' θα μπει αυτόματα από το server.js)
router.get('/', listingController.getListings);
router.post('/', listingController.createListing);

module.exports = router; // Εξάγουμε το router