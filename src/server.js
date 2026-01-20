require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB, config } = require("./config/config");
const authRoutes = require("./routes/auth");
const emailRoutes = require("./routes/emails");
const trackingRoutes = require("./routes/tracking");
const newsletterRoutes = require("./routes/newsletters");

// (only uncomment if you want to use scheduler, and first configure the env variables for credentials)
// require("./utils/emailScheduler"); 

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [

     `http://localhost:${process.env.LOCAL_PORT || 8080}`,
      process.env.FRONTEND_CORS_URL,
    
    ].filter(Boolean),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());

connectDB();

app.use("/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/newsletters", newsletterRoutes);


app.get("/api/debug/config", require("./controllers/trackingController").getConfig);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(`Server On`);
  
});