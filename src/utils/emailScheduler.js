const cron = require("node-cron");
const nodemailer = require("nodemailer");
const Subscription = require("../models/subscription");

const TIMEZONE = "Asia/Kolkata";

async function startEmailScheduler() {
  
  try {
     
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Missing EMAIL_USER or EMAIL_PASS in env");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.verify();
    console.log(" SMTP server ready");

    const emailJob = async () => {
      try {
        console.log(
          " Email job triggered at:",
          new Date().toLocaleString("en-IN", { timeZone: TIMEZONE })
        );

        const subscribers = await Subscription.find({ subscribed: true });

        if (!subscribers.length) {
          console.log(" No subscribed users found");
          return;
        }

        for (const user of subscribers) {
          if (!user.email) continue;

          await transporter.sendMail({
            from: `"Raybit Gmail Server" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Daily Newsletter by Raybit Gmail Server",
            html: `
              <h2>Hello 👋</h2>
              <p>This is your daily newsletter.</p>
              <p>Thanks for staying subscribed.</p>
            `
          });

          console.log(` Email sent to ${user.email}`);
        }
      } catch (err) {
        console.error(" Email job failed:", err.message);
      }
    };

    
    cron.schedule("0 16 * * *", emailJob, {
      timezone: TIMEZONE
    });

    console.log(" Email scheduler started (4:00 PM IST)");

  } catch (err) {
    console.error(" Email scheduler bootstrap failed:", err.message);
    process.exit(1); 
  }
}

startEmailScheduler();

module.exports = {};
