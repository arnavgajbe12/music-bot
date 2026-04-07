const { buildCategoryEmbed, buildSelectMenu } = require('../../slash/general/help');
const config = require('../../../../config');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show all available commands.',
  usage: '[category]',

  async run(client, message, args) {
    const validCategories = ['music', 'general', 'settings'];
    const category = validCategories.includes((args[0] || '').toLowerCase())
      ? args[0].toLowerCase()
      : 'music';

    const embed = buildCategoryEmbed(category);
    const row = buildSelectMenu(category);

    const reply = await message.reply({ embeds: [embed], components: [row] });

    // Auto-delete after 60 s to keep chat clean
    setTimeout(() => reply.delete().catch(() => {}), 60000);
  },
};
