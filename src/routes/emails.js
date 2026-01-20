const express = require("express");
const emailController = require("../controllers/emailController");

const router = express.Router();

router.get("/emails/replies/:userEmail", emailController.checkReplies);
router.get("/:userEmail/replies", emailController.checkReplies);

router.post("/:userEmail/send", emailController.sendEmail);
router.get("/:userEmail/sent", emailController.getSentEmails);
router.get("/:userEmail", emailController.getEmails);

module.exports = router;
