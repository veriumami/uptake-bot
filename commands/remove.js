module.exports = {
    name: 'remove',
    async execute(message, args, supabase) {
      const target = (args[0] || '').toLowerCase();
      if (target === 'all') {
        const { error } = await supabase
          .from('tracked_items')
          .delete()
          .eq('discord_user_id', message.author.id);
        if (error) {
          console.error('Supabase remove-all error:', error.message);
          await message.reply('Could not clear your tracked list.');
        } else {
          await message.reply('Cleared your entire tracked list.');
        }
        return;
      }
      const itemId = Number(target);
      if (!Number.isInteger(itemId)) {
        await message.reply('Please provide a numeric ID or use `!remove all`.');
        return;
      }
      const { error } = await supabase
        .from('tracked_items')
        .delete()
        .eq('discord_user_id', message.author.id)
        .eq('id', itemId);
      if (error) {
        console.error('Supabase remove error:', error.message);
        await message.reply(`Could not remove item with ID \`${itemId}\`. Please check the ID and try again.`);
      } else {
        await message.reply(`Successfully removed item with ID \`${itemId}\` from your list.`);
      }
    },
  };