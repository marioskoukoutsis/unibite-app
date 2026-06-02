const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/leaderboard', statsController.getLeaderboard);

module.exports = router;
