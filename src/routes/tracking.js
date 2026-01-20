const express = require("express");
const trackingController = require("../controllers/trackingController");

const router = express.Router();

router.get("/:trackingId", trackingController.trackEmail);
router.post("/manual/:trackingId", trackingController.manualTrack);

module.exports = router;