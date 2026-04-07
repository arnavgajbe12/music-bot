const { PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  name: '247',
  aliases: ['twentyfourseven'],
  description: 'Toggle 24/7 mode — the bot stays in the voice channel even when the queue is empty.',
  usage: '',

  async run(client, message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')] });
    }

    const settings = getSettings(message.guild.id);
    const newVal = !settings.mode247;
    updateSettings(message.guild.id, { mode247: newVal });

    return message.reply({
      embeds: [
        buildEmbed(
          newVal
            ? '🕐 24/7 mode is now **ON** — the bot will stay in the voice channel indefinitely.'
            : '🕐 24/7 mode is now **OFF** — the bot will leave when the queue is empty.',
        ),
      ],
    });
  },
};
