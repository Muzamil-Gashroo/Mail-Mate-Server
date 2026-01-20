const SentEmail = require("../models/sentEmail");

const trackingController = {
  trackEmail: async (req, res) => {
    try {
      const { trackingId } = req.params;

      console.log(`=== TRACKING REQUEST RECEIVED ===`);
      console.log(`Tracking ID: ${trackingId}`);
      console.log(`Time: ${new Date().toISOString()}`);

      const email = await SentEmail.findOne({ trackingId });

      if (email) {
        console.log(`Found email: ${email.subject} to ${email.to}`);

        if (!email.opened) {
          email.opened = true;
          email.openedAt = new Date();
          await email.save();
          console.log(`FIRST OPEN TRACKED at ${email.openedAt}`);
          console.log(`=== TRACKING SUCCESSFUL ===`);
        } else {
          console.log(` Email already opened at ${email.openedAt}`);
          console.log(`=== IGNORED (Already tracked) ===`);
        }
      } else {
        console.log(` No email found with tracking ID: ${trackingId}`);
        console.log(`=== TRACKING FAILED ===`);
      }

      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );

      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.send(pixel);
    } catch (err) {
      console.error("Tracking error:", err.message);
      res.status(200).send(''); 
    }
  },

  manualTrack: async (req, res) => {
    try {
      const { trackingId } = req.params;

      console.log(`Manual tracking trigger for: ${trackingId}`);

      const email = await SentEmail.findOne({ trackingId });

      if (!email) {
        return res.status(404).json({ error: "Tracking ID not found" });
      }

      if (email.opened) {
        return res.json({
          success: false,
          message: "Email already opened",
          email: {
            to: email.to,
            subject: email.subject,
            opened: email.opened,
            openedAt: email.openedAt
          }
        });
      }

      email.opened = true;
      email.openedAt = new Date();
      await email.save();

      console.log(`Manual tracking successful: ${email.subject}`);

      res.json({
        success: true,
        message: "Email marked as opened (first open)",
        email: {
          to: email.to,
          subject: email.subject,
          opened: email.opened,
          openedAt: email.openedAt
        }
      });
    } catch (err) {
      console.error("Manual tracking error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },

  getConfig: (req, res) => {
    const { config } = require("../config/config");
    res.json({
      trackingBaseUrl: config.TRACKING_BASE_URL,
      isNgrokConfigured: config.TRACKING_BASE_URL !== "http://localhost:5000",
      serverTime: new Date().toISOString(),
      env: {
        hasNgrokUrl: !!process.env.NGROK_URL
      }
    });
  }
};

module.exports = trackingController;