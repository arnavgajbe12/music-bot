/**
 * noprefix.js — No-prefix system management.
 *
 * Developer/Admin commands:
 *   !noprefixadd @user <time|permanent|perm>
 *   !noprefix remove @user
 *   !noprefix list  (alias: !nop)
 *
 * User self-toggle (requires an existing entry):
 *   !noprefix enable|on|true|yes
 *   !noprefix disable|off|false|no
 */

const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { EmbedBuilder } = require('discord.js');
const { noprefixList, noprefixRemove, noprefixSetEnabled } = require('../../../utils/setupManager');
const config = require('../../../../config');

function isDevOrAdmin(member) {
  return (
    config.botSetup.devs.includes(member.user.id) ||
    member.permissions.has('Administrator')
  );
}

module.exports = {
  name: 'noprefix',
  aliases: ['nop'],
  description: 'Manage no-prefix access for users.',
  usage: '<add|remove|list|enable|disable> [@user] [time]',
  hidden: false,

  async run(client, message, args) {
    const subcommand = (args[0] || '').toLowerCase();

    // ── Enable / Disable self-toggle (any user with an existing entry) ──────
    const ENABLE_WORDS = ['enable', 'on', 'true', 'yes'];
    const DISABLE_WORDS = ['disable', 'off', 'false', 'no'];

    if (ENABLE_WORDS.includes(subcommand) || DISABLE_WORDS.includes(subcommand)) {
      const entries = noprefixList();
      if (!entries[message.author.id]) {
        return message.reply({ embeds: [buildErrorEmbed('You do not have no-prefix access to toggle.')] });
      }
      const enable = ENABLE_WORDS.includes(subcommand);
      noprefixSetEnabled(message.author.id, enable);
      return message.reply({ embeds: [buildEmbed(`✅ No-prefix has been **${enable ? 'enabled' : 'disabled'}** for you.`)] });
    }

    // ── Admin / Dev only below this point ────────────────────────────────────
    if (!isDevOrAdmin(message.member)) {
      return message.reply({ embeds: [buildErrorEmbed('You need Administrator permission or Developer status to manage no-prefix access.')] });
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (subcommand === 'list' || subcommand === '') {
      const entries = noprefixList();
      const keys = Object.keys(entries);
      if (keys.length === 0) {
        return message.reply({ embeds: [buildEmbed('📋 No users have no-prefix access.')] });
      }
      const lines = keys.map((uid) => {
        const e = entries[uid];
        const status = e.enabled === false ? '🔴 disabled' : '🟢 enabled';
        const expiry = e.expiresAt ? `expires <t:${Math.floor(e.expiresAt / 1000)}:R>` : 'permanent';
        return `<@${uid}> — ${status} (${expiry})`;
      });
      const embed = new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle('📋 No-Prefix Access List')
        .setDescription(lines.join('\n'))
        .setFooter({ text: config.embeds.footerText });
      return message.reply({ embeds: [embed] });
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (subcommand === 'remove') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [buildErrorEmbed('Please mention a user to remove.')] });
      noprefixRemove(target.id);
      return message.reply({ embeds: [buildEmbed(`✅ Removed no-prefix access from **${target.username}**.`)] });
    }

    return message.reply({ embeds: [buildErrorEmbed(`Unknown subcommand. Use: \`enable\`, \`disable\`, \`remove @user\`, or \`list\`.\nTo add: use \`!noprefixadd @user <time|permanent>\``)] });
  },
};
