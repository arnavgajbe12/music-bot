const { PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  name: 'largeart',
  aliases: ['art'],
  description: 'Toggle large banner art (full-width image) vs small thumbnail.',
  usage: '<on|off>',

  async run(client, message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')] });
    }

    const arg = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(arg)) {
      return message.reply({ embeds: [buildErrorEmbed('Usage: `!largeart on` or `!largeart off`')] });
    }

    const newVal = arg === 'on';
    updateSettings(message.guild.id, { largeArt: newVal });

    return message.reply({
      embeds: [
        buildEmbed(
          newVal
            ? '🖼️ Large art is now **ON** — album artwork will be shown as a full-width banner.'
            : '🖼️ Large art is now **OFF** — album artwork will be shown as a small thumbnail.',
        ),
      ],
    });
  },
};
