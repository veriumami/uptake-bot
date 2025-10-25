// This file manages the Express web server.
const express = require('express');

// We wrap the server in a function that index.js can call
module.exports = (client) => {
  const app = express();
  app.use(express.json()); // This lets us read JSON from n8n
  const port = process.env.PORT || 10000;

  // Render Keep-Alive
  app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
  });

  // This is the "Delivery Slot" for all n8n workflows
  app.post('/stock-result', async (req, res) => {
    try {
      const { user_id, message } = req.body;

      if (!user_id || !message) {
        console.warn('Received incomplete stock result from n8n');
        return res.status(400).send('Missing data');
      }

      // We use the 'client' (the bot) that index.js passed to us
      const user = await client.users.fetch(user_id);
      
      if (user) {
        await user.send(message);
      }
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to send stock result DM:', error);
      res.status(500).send('Error processing stock result');
    }
  });

  app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
  });
};