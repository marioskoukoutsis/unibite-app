const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');

router.post('/', requestController.createRequest);
router.put('/:id/status', requestController.updateRequestStatus);
router.get('/', requestController.getRequestsForCook);
router.put('/:id/rating', requestController.rateRequest);

module.exports = router;
