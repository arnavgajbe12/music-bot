/**
 * devcmd.js — Hidden developer command.
 * Lists all developer-only commands and sends them via DM.
 * Only usable by developers listed in config.botSetup.devs.
 * Not listed in !help.
 */

const { buildErrorEmbed } = require('../../../utils/embeds');
const config = require('../../../../config');

const DEV_COMMANDS = [
  { name: 'eval', usage: '!eval <code>', desc: 'Evaluate arbitrary JavaScript in the bot context.' },
  { name: 'nodes', usage: '!nodes', desc: 'Show Lavalink node statistics.' },
  { name: 'devcmd', usage: '!devcmd', desc: 'Show this developer command list (DM only).' },
  { name: 'noprefixadd', usage: '!noprefixadd @user <time|permanent>', desc: 'Grant a user no-prefix access.' },
  { name: 'noprefix remove', usage: '!noprefix remove @user', desc: 'Revoke no-prefix access from a user.' },
  { name: 'noprefix list', usage: '!noprefix list', desc: 'List all no-prefix users.' },
  { name: '/prefix set', usage: '/prefix set <prefix>', desc: 'Overwrite the guild prefix (slash command).' },
  { name: '/prefix add', usage: '/prefix add <prefix>', desc: 'Add an additional guild prefix (slash command).' },
  { name: '/prefix remove', usage: '/prefix remove <prefix>', desc: 'Remove a guild prefix (slash command).' },
  { name: '/prefix list', usage: '/prefix list', desc: 'List all active guild prefixes (slash command).' },
];

module.exports = {
  name: 'devcmd',
  // No aliases – keep it quiet
  description: 'Developer-only: list all developer commands.',
  hidden: true,

  async run(client, message) {
    // Only allow developers defined in config
    if (!config.botSetup.devs.includes(message.author.id)) return;

    const lines = DEV_COMMANDS.map((c) => `\`${c.usage}\` — ${c.desc}`).join('\n');
    const dmContent =
      `**🔧 Developer Commands**\n\n` +
      lines +
      `\n\n> These commands are hidden from the public help menu.`;

    try {
      const dmChannel = await message.author.createDM();
      await dmChannel.send(dmContent);
      const reply = await message.channel.send({ embeds: [{ color: 0x57f287, description: '📬 Developer commands sent to your DMs.' }] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch {
      await message.channel.send({ embeds: [buildErrorEmbed('Could not send you a DM. Please enable DMs from server members.')] });
    }
  },
};
