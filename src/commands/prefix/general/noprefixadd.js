/**
 * noprefixadd.js — Grant a user no-prefix access.
 * Usage: !noprefixadd @user <time|permanent|perm>
 * Examples:
 *   !noprefixadd @Bob 7d
 *   !noprefixadd @Alice permanent
 *
 * Only usable by Developers or Server Administrators.
 */

const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { noprefixAdd } = require('../../../utils/setupManager');
const config = require('../../../../config');

function parseTime(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  if (s === 'permanent' || s === 'perm') return null;
  const match = s.match(/^(\d+)([smhdw])$/);
  if (!match) return null;
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const ms = parseInt(num, 10) * (multipliers[unit] || 0);
  return ms > 0 ? ms : null;
}

module.exports = {
  name: 'noprefixadd',
  aliases: [],
  description: 'Grant a user no-prefix access.',
  usage: '@user <time|permanent>',

  async run(client, message, args) {
    const isDev = config.botSetup.devs.includes(message.author.id);
    const isAdmin = message.member.permissions.has('Administrator');
    if (!isDev && !isAdmin) {
      return message.reply({ embeds: [buildErrorEmbed('You need Administrator permission or Developer status to use this command.')] });
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply({ embeds: [buildErrorEmbed('Please mention a user. Usage: `!noprefixadd @user <time|permanent>`')] });
    }

    const timeArg = args[1] || 'permanent';
    const duration = parseTime(timeArg);
    const expiresAt = duration !== null ? Date.now() + duration : null;

    noprefixAdd(target.id, expiresAt);

    const expStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'permanently';
    return message.reply({
      embeds: [buildEmbed(`✅ Granted no-prefix access to **${target.username}** ${expStr}.`)],
    });
  },
};
