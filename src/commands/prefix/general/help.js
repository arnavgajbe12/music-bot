const { buildCategoryEmbed, buildSelectMenu } = require('../../slash/general/help');
const { getPrefixes } = require('../../../utils/setupManager');

const HELP_AUTO_DELETE_MS = 60_000; // 60 seconds
const VALID_CATEGORIES = ['music', 'platform', 'setup', 'dj', 'general'];

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show all available commands.',
  usage: '[category]',

  async run(client, message, args) {
    const category = VALID_CATEGORIES.includes((args[0] || '').toLowerCase())
      ? args[0].toLowerCase()
      : 'music';

    const prefixes = getPrefixes(message.guild.id);
    const displayPrefix = prefixes[0] || '!';
    const embed = buildCategoryEmbed(category, displayPrefix);
    const row = buildSelectMenu(category);

    const reply = await message.channel.send({ embeds: [embed], components: [row] });

    // Auto-delete to keep chat clean
    setTimeout(() => reply.delete().catch(() => {}), HELP_AUTO_DELETE_MS);
  },
};
