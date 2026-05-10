const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

// Οι παλιές μας διαδρομές
router.get('/', listingController.getListings);
router.post('/', listingController.createListing);

// ΟΙ ΝΕΕΣ ΜΑΣ ΔΙΑΔΡΟΜΕΣ:
// PUT για επεξεργασία, DELETE για διαγραφή. Το ":id" είναι μεταβλητή!
router.put('/:id', listingController.updateListing);
router.delete('/:id', listingController.deleteListing);

module.exports = router;