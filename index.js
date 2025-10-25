// --- Discord Bot Requirements ---
const { Client, GatewayIntentBits, Partials, Collection, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const BOT_PREFIX = '!';
const GENERAL_CHANNEL_ID = '1408223905348587524';

// --- DE-DUPE ---
const processedMessages = new Set();

// --- Supabase Client Initialization ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// --- Discord Client Initialization ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages], 
    partials: [Partials.Channel], // Required for DMs
});

// --- NEW: Command Handler ---
// We use a Collection (a fancy Map) to store our commands.
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Set a new item in the Collection with the key as the command name
  if (command.name) {
    client.commands.set(command.name, command);
    console.log(`Loaded command: ${command.name}`);
  } else {
    console.warn(`The command at ${filePath} is missing a "name" or "execute" property.`);
  }
}
// --- END: Command Handler ---


// --- NEW: Start the Web Server ---
// We run the server code, which is now in its own file.
// We pass it the 'client' so the server can use the bot.
require('./server.js')(client);
// --- END: Start Server ---


// --- Your original parseProductData function ---
// This is used by multiple parts, so we'll keep it here
function parseProductData(embed) {
  if (!embed) return { sku: null, colorway: null, itemTitle: null };
  const findFieldValue = (name) =>
    embed.fields?.find(f => f.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
  let sku = findFieldValue('sku');
  if (!sku && embed.url) {
    const skuMatch = embed.url.match(/([a-zA-Z0-9]+-[0-9]+)$/);
    if (skuMatch) sku = skuMatch[1];
  }
  let colorway = findFieldValue('colorway');
  if (!colorway && embed.title) {
    const colorMatch = embed.title.match(/"([^"]+)"|'([^']+)'/);
    if (colorMatch) colorway = colorMatch[1] || colorMatch[2];
  }
  const itemTitle = embed.title ? embed.title.replace(/^RESTOCK —\s*/i, '').trim() : null;
  const normalizedSku = sku ? sku.toUpperCase().trim() : null;
  const normalizedColorway = colorway ? colorway.toLowerCase().trim() : null;
  return { sku: normalizedSku, colorway: normalizedColorway, itemTitle };
}


// --- Main Message Handler (Now much smaller!) ---
client.on('messageCreate', async (message) => {
  // Ignore bots and de-dupe
  if (message.author.bot) return;
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 60000);

  try {
    // --- WORKFLOW 1: Direct Messages ---
    if (message.channel.type === ChannelType.DM) {
      // 1.1 Forwarded messages (message snapshots)
      const snapshot = message.messageSnapshots?.size ? message.messageSnapshots.first() : null;
      if (snapshot) {
        // This is a special case, so we'll handle it here.
        // This logic is from your original file.
        const embed = snapshot.embeds?.[0] ?? null;
        if (!embed) {
          await message.reply("This forwarded message doesn't contain an embed. I can't save it.");
          return;
        }
        const { sku, colorway, itemTitle } = parseProductData(embed);
        if (!sku) {
          await message.reply("I couldn't find a valid SKU in that embed. Please try another item.");
          return;
        }
        const row = {
          discord_user_id: message.author.id,
          discord_user_name: message.author.tag,
          sku, colorway, item_title: itemTitle, full_embed_data: embed,
        };
        const { error } = await supabase
          .from('tracked_items')
          .upsert(row, { onConflict: 'discord_user_id,sku' });
        if (error) {
          console.error('Supabase insert error:', error.message);
          await message.react('❌');
        } else {
          await message.react('✅');
          const linkDM = embed?.url ?? message.url;
          if (linkDM) {
            await supabase.from('item_seeds').upsert({
              discord_user_id: message.author.id, sku, url: linkDM, last_seen: new Date().toISOString(),
            }, { onConflict: 'discord_user_id,sku,url' });
          }
        }
        return; // end forwarded-DM workflow
      }

      // 1.2 Commands in DM
      if (message.content?.startsWith(BOT_PREFIX)) {
        const args = message.content.slice(BOT_PREFIX.length).trim().split(/\s+/);
        const commandName = (args.shift() || '').toLowerCase();

        // Find the command in our new Collection
        const command = client.commands.get(commandName);

        if (!command) {
          await message.reply('Unknown command.');
          return;
        }

        try {
          // Execute the command's file!
          await command.execute(message, args, supabase);
        } catch (error) {
          console.error('Error executing command:', error);
          await message.reply('There was an error trying to execute that command.');
        }
        return;
      }
      // Non-forwarded, non-command DM: ignore or help
      return;
    }

    // --- WORKFLOW 2: General channel matching ---
    if (message.channel.id === GENERAL_CHANNEL_ID) {
      // This logic is also from your original file.
      const embed = message.embeds?.[0] ?? null;
      if (!embed) return;
      const { sku } = parseProductData(embed);
      if (!sku) return;
      
      const { data: usersToNotify, error } = await supabase
        .from('tracked_items').select('discord_user_id').eq('sku', sku);
      if (error) {
        console.error('Matching Engine: Supabase error:', error.message);
        return;
      }

      if (usersToNotify && usersToNotify.length > 0) {
        const uniqueUserIds = new Set(usersToNotify.map(u => u.discord_user_id));
        const link = embed?.url ?? message.url;
        for (const userId of uniqueUserIds) {
          try {
            const user = await client.users.fetch(userId);
            if (link) {
              await supabase.from('item_seeds').upsert({
                discord_user_id: userId, sku, url: link, last_seen: new Date().toISOString(),
              }, { onConflict: 'discord_user_id,sku,url' });
            }
            await user.send(`Tracked Item Restocked!\nFound a match for SKU \`${sku}\`.\n\n${link ?? ''}`);
          } catch (dmError) {
            console.error(`Matching Engine: Failed to send DM to user ${userId}:`, dmError?.message);
          }
        }
      }
      return;
    }
  } catch (err) {
    console.error('Handler crash:', err);
    try { await message.react('❌'); } catch {}
  }
});
// --- Bot Login ---
client.login(process.env.DISCORD_TOKEN);