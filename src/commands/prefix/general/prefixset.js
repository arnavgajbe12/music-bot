/**
 * prefixset.js — Overwrite the server prefix.
 * Usage: !prefixset <newprefix>
 * Server Admins only.
 */

const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { setPrefixes } = require('../../../utils/setupManager');

module.exports = {
  name: 'prefixset',
  aliases: [],
  description: 'Set (overwrite) the server command prefix.',
  usage: '<newprefix>',

  async run(client, message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply({ embeds: [buildErrorEmbed('You need Administrator permission to change the server prefix.')] });
    }

    const newPrefix = args[0];
    if (!newPrefix) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a new prefix. Usage: `!prefixset <prefix>`')] });
    }

    if (newPrefix.length > 5) {
      return message.reply({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')] });
    }

    setPrefixes(message.guild.id, [newPrefix]);
    return message.reply({ embeds: [buildEmbed(`✅ Server prefix set to \`${newPrefix}\`.`)] });
  },
};
