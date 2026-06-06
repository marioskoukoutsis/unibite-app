const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Στατιστικά (υπάρχον)
router.get('/stats', adminController.getStats);


// Αγγελίες
router.get('/listings', adminController.getAllListings);
router.delete('/listings/:id', adminController.deleteListing);

// Αιτήματα
router.get('/requests', adminController.getRecentRequests);

module.exports = router;