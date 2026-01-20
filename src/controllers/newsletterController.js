const Subscription = require("../models/subscription");

const newsletterController = {

  subscribe: async (req, res) => {

    try {
      
      const email  = req.body.email;
      const user = await Subscription.findOne({ email });
      
      if (user && user.subscribed) {
        
        return res.status(404).json({ error: "This email is already subscribed" });

      }else if(user && !user.subscribed){
      
        user.subscribed = true;
        await user.save();
        res.json({ message: "Subscribed successfully" });

      }
      else{
       
      const subscription = new Subscription({ 
         
         email: email,
         subscribed: true
         });

      await subscription.save();
      res.json({ message: "Subscribed successfully" });

      }

    } catch (error) {

      res.status(500).json({ error: error.message });
      
    }
  },

  unsubscribe: async (req, res) => {

    
    try {
      
      const email  = req.body.email;
      const user = await Subscription.findOne({ email });
      
      if (user && user.subscribed) {
        
        user.subscribed = false;
        await user.save();

        res.json({ message: "Unsubscribed successfully" });

      }else if(user && !user.subscribed){

        return res.status(404).json({ error: "This email is already unsubscribed" });

      }else{
        return res.status(404).json({ error: "This email is not subscribed" });
      }
      
    } catch (error) {

      res.status(500).json({ error: error.message });
      
    }}

};

module.exports = newsletterController;

