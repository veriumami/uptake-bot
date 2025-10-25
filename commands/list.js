module.exports = {
    name: 'list',
    async execute(message, args, supabase) {
      const { data, error } = await supabase
        .from('tracked_items')
        .select('id, sku, colorway, item_title, created_at')
        .eq('discord_user_id', message.author.id)
        .order('created_at', { ascending: false })
        .limit(100);
  
      if (error) {
        console.error('Supabase list error:', error.message);
        await message.reply('Could not retrieve your tracked items.');
        return;
      }
      if (!data || data.length === 0) {
        await message.reply('You have no tracked items. Use `!track <SKU>` or forward a product embed to add one.');
        return;
      }
      const lines = data.map((row) => {
        const title = row.item_title ?? '(no title)';
        const cw = row.colorway ? ` (${row.colorway})` : '';
        const when = row.created_at ? new Date(row.created_at).toLocaleString() : '';
        return `[${row.id}] ${row.sku} — ${title}${cw}${when ? ` — added: ${when}` : ''}`;
      });
  
      const chunks = [];
      let current = 'Your tracked items:\n';
      for (const line of lines) {
        const add = line + '\n';
        if ((current + add).length > 1800) {
          chunks.push(current);
          current = add;
        } else {
          current += add;
        }
      }
      if (current) chunks.push(current);
      for (const part of chunks) await message.reply(part);
    },
  };