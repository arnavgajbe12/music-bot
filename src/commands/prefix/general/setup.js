const { PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { buildSetupIdleV2 } = require('../../../utils/componentBuilder');
const { saveSetup, removeSetup, getSettings } = require('../../../utils/setupManager');

module.exports = {
  name: 'setup',
  aliases: [],
  description: 'Configure the dedicated Song Request channel.',
  usage: '<#channel | remove>',

  async run(client, message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')] });
    }

    if (!args.length) {
      return message.reply({ embeds: [buildErrorEmbed('Usage: `!setup #channel` or `!setup remove`')] });
    }

    if (args[0].toLowerCase() === 'remove') {
      removeSetup(message.guild.id);
      return message.reply({ embeds: [buildEmbed('🗑️ Song Request channel has been removed.')] });
    }

    // Accept a channel mention (<#id>) or a bare channel ID
    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel?.isTextBased()) {
      return message.reply({
        embeds: [buildErrorEmbed('Please mention a valid text channel, e.g. `!setup #music`')],
      });
    }

    const settings = getSettings(message.guild.id);
    const payload = buildSetupIdleV2(settings.largeArt);

    let panelMsg;
    try {
      panelMsg = await channel.send(payload);
    } catch {
      return message.reply({
        embeds: [buildErrorEmbed(`Failed to send the panel to ${channel}. Make sure I have permission to send messages there.`)],
      });
    }

    saveSetup(message.guild.id, channel.id, panelMsg.id);

    return message.reply({
      embeds: [
        buildEmbed(
          `✅ Song Request channel set to ${channel}.\n\nUsers can now type a song name (or use \`yt\`, \`sp\`, \`ap\`, etc. as a prefix) directly in that channel to request songs!`,
        ),
      ],
    });
  },
};
