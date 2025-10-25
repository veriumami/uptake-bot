module.exports = {
    name: 'seeds',
    async execute(message, args, supabase) {
      const skuFilter = args[0]?.toUpperCase()?.trim() || null;
      let query = supabase
        .from('item_seeds')
        .select('sku,url,last_seen')
        .eq('discord_user_id', message.author.id)
        .order('last_seen', { ascending: false })
        .limit(50);
      if (skuFilter) query = query.eq('sku', skuFilter);
  
      const { data, error } = await query;
      if (error) {
        console.error('Supabase seeds error:', error.message);
        await message.reply('Could not retrieve your seeds.');
        return;
      }
      if (!data || data.length === 0) {
        await message.reply(skuFilter ? `No seeds found for ${skuFilter}.` : 'No seeds recorded yet.');
        return;
      }
      const bySku = new Map();
      for (const row of data) {
        if (!bySku.has(row.sku)) bySku.set(row.sku, []);
        bySku.get(row.sku).push(`• ${row.url} (seen: ${new Date(row.last_seen).toLocaleString()})`);
      }
      const chunks = [];
      let current = '';
      for (const [sku, lines] of bySku) {
        const block = `SKU ${sku}:\n${lines.join('\n')}\n\n`;
        if ((current + block).length > 1800) {
          chunks.push(current);
          current = block;
        } else {
          current += block;
        }
      }
      if (current) chunks.push(current);
      for (const part of chunks) await message.reply(part);
    },
  };