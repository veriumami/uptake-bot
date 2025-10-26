const axios = require('axios'); // We need axios to call n8n

module.exports = {
  name: 'checkstock',
  async execute(message, args, supabase) {
    const url = args[0]?.trim();
    if (!url || !url.startsWith('http')) {
      await message.reply('Please provide a full product URL. Usage: `!checkstock <URL>`');
      return;
    }

    let targetWebhook = '';

    // --- This is the "Smart Router" ---
    // It reads the webhook URLs from your Render Environment Variables
    if (url.includes('dtlr.com')) {
      targetWebhook = process.env.N8N_CLASSIC_SHOPIFY_WEBHOOK;
    } else if (url.includes('shoepalace.com')) {
      targetWebhook = process.env.N8N_SHOE_PALACE_WEBHOOK;
    } else if (url.includes('kidsfootlocker.com')) {
      targetWebhook = process.env.N8N_KIDSFOOTLOCKER_WEBHOOK;
    } else {
      await message.reply('Sorry, I do not support that website yet.');
      return;
    }

    if (!targetWebhook) {
      await message.reply('Sorry, the webhook for that site is not configured. Please tell the admin.');
      console.error(`Missing webhook environment variable for URL: ${url}`);
      return;
    }

    await message.reply(`🔍 On it! Checking stock for you. This may take 1-2 minutes...`);

    try {
      // Send the "order" to the correct n8n "Runner"
      await axios.post(targetWebhook, {
        url: url, // We just send the full URL
        user_id: message.author.id,
      });
    } catch (err) {
      console.error('Failed to trigger n8n stock check:', err.message);
      await message.reply('Sorry, my "Runner" for that site seems to be offline.');
    }
  },
};
