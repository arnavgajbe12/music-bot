/**
 * prefixlist.js — Show all active prefixes for the server.
 * Usage: !prefixlist
 */

const { buildEmbed } = require('../../../utils/embeds');
const { getPrefixes } = require('../../../utils/setupManager');

module.exports = {
  name: 'prefixlist',
  aliases: ['prefixes'],
  description: 'Show all active command prefixes for this server.',
  usage: '',

  async run(client, message) {
    const prefixes = getPrefixes(message.guild.id);
    return message.reply({
      embeds: [buildEmbed(`📋 **Active Prefixes:** ${prefixes.map((p) => `\`${p}\``).join(', ')}`)],
    });
  },
};
