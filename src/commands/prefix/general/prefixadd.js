/**
 * prefixadd.js — Add an additional prefix to the server.
 * Usage: !prefixadd <prefix>
 * Server Admins only.
 */

const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { addPrefix, getPrefixes } = require('../../../utils/setupManager');

module.exports = {
  name: 'prefixadd',
  aliases: [],
  description: 'Add an additional command prefix for this server.',
  usage: '<prefix>',

  async run(client, message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply({ embeds: [buildErrorEmbed('You need Administrator permission to manage prefixes.')] });
    }

    const prefix = args[0];
    if (!prefix) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a prefix. Usage: `!prefixadd <prefix>`')] });
    }

    if (prefix.length > 5) {
      return message.reply({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')] });
    }

    const current = getPrefixes(message.guild.id);
    if (current.includes(prefix)) {
      return message.reply({ embeds: [buildErrorEmbed(`\`${prefix}\` is already an active prefix.`)] });
    }

    addPrefix(message.guild.id, prefix);
    const updated = getPrefixes(message.guild.id);
    return message.reply({ embeds: [buildEmbed(`✅ Added prefix \`${prefix}\`. Active prefixes: ${updated.map((p) => `\`${p}\``).join(', ')}`)] });
  },
};
