/**
 * prefixremove.js — Remove a prefix from the server.
 * Usage: !prefixremove <prefix>
 * Server Admins only.
 */

const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { removePrefix, getPrefixes } = require('../../../utils/setupManager');
const config = require('../../../../config');

module.exports = {
  name: 'prefixremove',
  aliases: ['prefixdel'],
  description: 'Remove a command prefix from this server.',
  usage: '<prefix>',

  async run(client, message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply({ embeds: [buildErrorEmbed('You need Administrator permission to manage prefixes.')] });
    }

    const prefix = args[0];
    if (!prefix) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a prefix to remove. Usage: `!prefixremove <prefix>`')] });
    }

    const current = getPrefixes(message.guild.id);
    if (current.length === 1 && current[0] === prefix) {
      return message.reply({ embeds: [buildErrorEmbed('Cannot remove the last remaining prefix. Use `!prefixset` to replace it instead.')] });
    }

    const removed = removePrefix(message.guild.id, prefix);
    if (!removed) {
      return message.reply({ embeds: [buildErrorEmbed(`\`${prefix}\` is not an active prefix for this server.`)] });
    }

    const updated = getPrefixes(message.guild.id);
    return message.reply({
      embeds: [buildEmbed(`✅ Removed prefix \`${prefix}\`. Active prefixes: ${updated.map((p) => `\`${p}\``).join(', ')}`)],
    });
  },
};
