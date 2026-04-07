const config = require('../../../config');
const { buildErrorEmbed } = require('../../utils/embeds');

module.exports = {
  once: false,
  async run(client, message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(config.botSetup.prefix)) return;

    const args = message.content.slice(config.botSetup.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.run(client, message, args);
    } catch (error) {
      console.error(`[MessageCreate] Error in prefix command "${commandName}":`, error);
      await message.reply({ embeds: [buildErrorEmbed('An error occurred while running that command.')] }).catch(() => {});
    }
  },
};
