const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

// Λίστα & δημιουργία αγγελιών
router.get('/', listingController.getListings);
router.post('/', listingController.createListing);

// Επεξεργασία & διαγραφή συγκεκριμένης αγγελίας (:id)
router.put('/:id', listingController.updateListing);
router.delete('/:id', listingController.deleteListing);

module.exports = router;