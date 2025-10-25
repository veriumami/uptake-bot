module.exports = {
    name: 'removeseeds',
    async execute(message, args, supabase) {
      const target = (args[0] || '').toLowerCase();
      if (!target) {
        await message.reply('Please provide a SKU or `all`. Usage: `!removeseeds <SKU>` or `!removeseeds all`.');
        return;
      }
      let query = supabase
        .from('item_seeds')
        .delete()
        .eq('discord_user_id', message.author.id);
  
      if (target === 'all') {
        const { error } = await query;
        if (error) {
          console.error('Supabase removeseeds (all) error:', error.message);
          await message.reply('Could not clear your seed history.');
        } else {
          await message.reply('Successfully cleared your entire seed history.');
        }
      } else {
        const skuToRemove = target.toUpperCase();
        query = query.eq('sku', skuToRemove);
        const { error } = await query;
        if (error) {
          console.error('Supabase removeseeds (SKU) error:', error.message);
          await message.reply(`Could not remove seeds for SKU \`${skuToRemove}\`.`);
        } else {
          await message.reply(`Successfully removed all seeds for SKU \`${skuToRemove}\`.`);
        }
      }
    },
  };