const { PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { buildSetupIdleV2 } = require('../../../utils/componentBuilder');
const { saveSetup, removeSetup, getSetup } = require('../../../utils/setupManager');

module.exports = {
  name: 'setup',
  aliases: [],
  description: 'Configure the dedicated Song Request channel.',
  usage: '<#channel | remove>',

  async run(client, message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.channel.send({ embeds: [buildErrorEmbed('You need the **Manage Server** permission to use this command.')] });
    }

    if (!args.length) {
      return message.channel.send({ embeds: [buildErrorEmbed('Usage: `!setup #channel` or `!setup remove`')] });
    }

    if (args[0].toLowerCase() === 'remove') {
      removeSetup(message.guild.id);
      return message.channel.send({ embeds: [buildEmbed('🗑️ Song Request channel has been removed.')] });
    }

    // Accept a channel mention (<#id>) or a bare channel ID
    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel?.isTextBased()) {
      return message.channel.send({
        embeds: [buildErrorEmbed('Please mention a valid text channel, e.g. `!setup #music`')],
      });
    }

    // Block setting a new setup channel if one is already configured
    const existing = getSetup(message.guild.id);
    if (existing) {
      return message.channel.send({
        embeds: [buildErrorEmbed(`A Song Request channel is already configured (<#${existing.channelId}>). Please run \`!setup remove\` first.`)],
      });
    }

    const payload = buildSetupIdleV2();

    let panelMsg;
    try {
      panelMsg = await channel.send(payload);
    } catch {
      return message.channel.send({
        embeds: [buildErrorEmbed(`Failed to send the panel to ${channel}. Make sure I have permission to send messages there.`)],
      });
    }

    saveSetup(message.guild.id, channel.id, panelMsg.id);

    return message.channel.send({
      embeds: [
        buildEmbed(
          `✅ Song Request channel set to ${channel}.\n\nUsers can now type a song name (or use \`yt\`, \`sp\`, \`ap\`, etc. as a prefix) directly in that channel to request songs!`,
        ),
      ],
    });
  },
};
