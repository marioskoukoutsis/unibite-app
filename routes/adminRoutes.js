const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Στατιστικά (υπάρχον)
router.get('/stats', adminController.getStats);

// Χρήστες
router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// Αγγελίες
router.get('/listings', adminController.getAllListings);
router.delete('/listings/:id', adminController.deleteListing);

// Αιτήματα
router.get('/requests', adminController.getRecentRequests);

module.exports = router;