const axios = require("axios");
const querystring = require("querystring");
const User = require("../models/user");
const { config } = require("../config/config");

const authController = {
  googleAuth: (req, res) => {

    const url = "https://accounts.google.com/o/oauth2/v2/auth?" +
      querystring.stringify({
        client_id: config.CLIENT_ID,
        redirect_uri: config.REDIRECT_URI,
        response_type: "code",
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.modify"

        ].join(" "),
        access_type: "offline",
        prompt: "consent",
      });

    res.redirect(url);
  },

  googleCallback: async (req, res) => {

    const code = req.query.code;

    if (!code) {
      console.error("No authorization code received");
      return res.status(400).send("Error: No authorization code received");
    }

    try {
      
      console.log("Step 1: Exchanging code for tokens...");

      const tokenResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        querystring.stringify({
          code,
          client_id: config.CLIENT_ID,
          client_secret: config.CLIENT_SECRET,
          redirect_uri: config.REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const { access_token, refresh_token } = tokenResponse.data;
      console.log("Step 2: Tokens received successfully");

      const userInfo = await axios.get(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${access_token}`
      );

      const data = userInfo.data;
      console.log("Step 3: User info received:", data.email);

      let user = await User.findOne({ email: data.email });

      if (user) {
        console.log("Updating existing user...");
        user.accessToken = access_token;
        if (refresh_token) user.refreshToken = refresh_token;
        user.name = data.name;
        user.picture = data.picture;
        await user.save();
        console.log("User updated successfully!");
      } else {
          console.log("Creating new user...");
          
          user = new User({
          email: data.email,
          googleId: data.sub,
          sub: data.sub,
          name: data.name,
          given_name: data.given_name,
          family_name: data.family_name,
          picture: data.picture,
          email_verified: data.email_verified,
          accessToken: access_token,
          refreshToken: refresh_token

        });
        await user.save();
        console.log("New user saved successfully!");
      }

      // res.redirect(`${config.FRONTEND_URL}?auth=success&email=${encodeURIComponent(data.email)}`);
      
      res.redirect(`https://mail-mate-frontend.vercel.app/?auth=success&email=${encodeURIComponent(data.email)}`);
      
    } catch (err) {
      console.error("ERROR during authentication:");
      console.error("Message:", err.message);
      console.error("Response data:", err.response?.data);

      res.status(500).send(`
        <html>
          <head><title>Authentication Failed</title></head>
          <body style="font-family: Arial; padding: 40px;">
            <h1 style="color: red;">Authentication Failed</h1>
            <p><strong>Error:</strong> ${err.message}</p>
            <pre>${JSON.stringify(err.response?.data || {}, null, 2)}</pre>
            <p><a href="/auth/google">Try Again</a></p>
          </body>
        </html>
      `);
    }
  }
};

module.exports = authController;