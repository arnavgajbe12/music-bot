const { PermissionFlagsBits } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { getSettings } = require('../../../utils/setupManager');
const { buildSourcePanel } = require('../../slash/general/source');

module.exports = {
  name: 'source',
  aliases: [],
  description: 'Set the default metadata and playback source platforms.',
  usage: '',

  async run(client, message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')] });
    }

    const settings = getSettings(message.guild.id);
    const panel = buildSourcePanel(
      settings.metadataSource || 'youtube',
      settings.playbackSource || 'ytmsearch:',
    );

    return message.reply(panel);
  },
};
