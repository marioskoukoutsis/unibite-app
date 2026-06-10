const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Συνολικά στατιστικά για το dashboard
router.get('/stats', adminController.getStats);

// Διαχείριση αγγελιών
router.get('/listings', adminController.getAllListings);
router.delete('/listings/:id', adminController.deleteListing);

// Πρόσφατα αιτήματα
router.get('/requests', adminController.getRecentRequests);

module.exports = router;