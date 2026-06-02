const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/user/:id', authController.getUser);
router.put('/update/:id', authController.updateAccount);

module.exports = router;