module.exports = {
    name: 'track',
    async execute(message, args, supabase) {
      const raw = args[0]?.trim();
      if (!raw || /\s/.test(raw)) {
        await message.reply('Please provide a single SKU (no spaces). Usage: `!track <SKU>`');
        return;
      }
      const skuToInsert = raw.toUpperCase();
      const { error } = await supabase.from('tracked_items').upsert({
        discord_user_id: message.author.id,
        discord_user_name: message.author.tag,
        sku: skuToInsert,
        item_title: null,
        colorway: null,
      }, { onConflict: 'discord_user_id,sku' });
  
      if (error) {
        console.error('Supabase track error:', error.message);
        await message.reply('There was an error trying to track this SKU.');
      } else {
        await message.reply(`Now tracking SKU: ${skuToInsert}. You'll be notified of future restocks.`);
      }
    },
  };