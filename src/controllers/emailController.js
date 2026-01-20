const axios = require("axios");
const User = require("../models/user");
const SentEmail = require("../models/sentEmail");
const { config } = require("../config/config");
const { parseEmailBody } = require("../utils/emailParser");

const emailController = {

  getEmails: async (req, res) => {
    try {
      const userEmail = req.params.userEmail;
      const maxResults = parseInt(req.query.maxResults) || 10;
      const pageToken = req.query.pageToken || null;

      const user = await User.findOne({ email: userEmail });
      if (!user || !user.accessToken) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
      if (pageToken) gmailUrl += `&pageToken=${pageToken}`;

      const messagesResponse = await axios.get(gmailUrl, {
        headers: { Authorization: `Bearer ${user.accessToken}` }
      });

      const messageIds = messagesResponse.data.messages || [];

      const emailResponses = await Promise.all(
        messageIds.map(msg =>
          axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            { headers: { Authorization: `Bearer ${user.accessToken}` } }
          )
        )
      );

      const emails = emailResponses.map(response => {
        const message = response.data;
        const headers = {};

        message.payload.headers.forEach(h => {
          headers[h.name.toLowerCase()] = h.value;
        });

        return {
          id: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds,
          subject: headers.subject || "(No Subject)",
          from: headers.from || "",
          to: headers.to || "",
          date: headers.date || "",
          body: parseEmailBody(message.payload),
          snippet: message.snippet
        };
      });

      res.json({
        emails,
        nextPageToken: messagesResponse.data.nextPageToken
      });

    } catch (err) {
      res.status(500).json({ error: "Failed to fetch emails", details: err.message });
    }
  },

  sendEmail: async (req, res) => {
    try {
      const userEmail = req.params.userEmail;
      const { to, subject, body, trackRead } = req.body;

      if (!to || !subject || !body) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const user = await User.findOne({ email: userEmail });
      if (!user || !user.accessToken) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const trackingId = trackRead
        ? `${Date.now()}-${Math.random().toString(36).substring(7)}`
        : null;

      let emailBody = body.replace(/\n/g, "<br>");
      if (trackingId) {
        emailBody += `<img src="${config.TRACKING_BASE_URL}/api/track/${trackingId}" width="1" height="1" style="display:none" />`;
      }

      const emailLines = [
        `To: ${to}`,
        `From: ${userEmail}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        emailBody
      ];

      const encodedEmail = Buffer.from(emailLines.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await axios.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        { raw: encodedEmail },
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (trackingId) {
        try {
          const savedEmail = await SentEmail.create({
            trackingId,
            messageId: response.data.id,
            threadId: response.data.threadId,
            from: userEmail,
            to,
            subject
          });
          console.log("Email tracking record saved:", savedEmail._id);
        } catch (saveErr) {
          console.error("Failed to save email tracking record:", saveErr.message);
        }
      }

      res.json({
        success: true,
        messageId: response.data.id,
        threadId: response.data.threadId,
        trackingId
      });

    } catch (err) {
      res.status(500).json({ error: "Failed to send email", details: err.message });
    }
  },

  checkReplies: async (req, res) => {
  try {
    const userEmail = req.params.userEmail.toLowerCase();

    const user = await User.findOne({ email: userEmail });
    if (!user?.accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sentEmails = await SentEmail.find({
      from: userEmail,
      replied: false
    });

    for (const email of sentEmails) {
      const threadRes = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${email.threadId}`,
        {
          headers: {
            Authorization: `Bearer ${user.accessToken}`
          }
        }
      );

      const messages = threadRes.data.messages || [];

      const reply = messages.find(msg => {
        const headers = {};
        msg.payload.headers.forEach(h => {
          headers[h.name.toLowerCase()] = h.value;
        });

        return (
          headers.from &&
          !headers.from.toLowerCase().includes(userEmail)
        );
      });

      if (reply) {
        email.replied = true;
        email.repliedAt = new Date(Number(reply.internalDate));
        email.replyMessageId = reply.id;
        await email.save();
      }
    }

    res.json({ success: true, message: "Reply tracking updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Reply check failed" });
  }
},
    //  FETCH SENT EMAILS (WITH STATUS)
  getSentEmails: async (req, res) => {
    try {
      const userEmail = req.params.userEmail;

      const emails = await SentEmail.find({ from: userEmail })
        .sort({ sentAt: -1 })
        .limit(50);

      res.json({
        success: true,
        emails
      });

    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sent emails" });
    }
  }
};

module.exports = emailController;
