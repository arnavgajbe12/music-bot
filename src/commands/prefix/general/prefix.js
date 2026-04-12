const { PermissionFlagsBits } = require('discord.js');
const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { setPrefixes } = require('../../../utils/setupManager');

module.exports = {
  name: 'prefix',
  aliases: [],
  description: 'Change the bot\'s command prefix for this server.',
  usage: '<new_prefix>',

  async run(client, message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send({ embeds: [buildErrorEmbed('You need the **Administrator** permission to change the prefix.')] });
    }

    if (!args.length) {
      return message.channel.send({ embeds: [buildErrorEmbed('Usage: `!prefix <new_prefix>`')] });
    }

    const newPrefix = args[0];
    if (newPrefix.length > 5) {
      return message.channel.send({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')] });
    }

    setPrefixes(message.guild.id, [newPrefix]);
    return message.channel.send({ embeds: [buildEmbed(`✅ Server prefix changed to \`${newPrefix}\`.`)] });
  },
};
