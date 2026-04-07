const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildQueueV2 } = require('../../../utils/componentBuilder');
const { MessageFlags } = require('discord.js');

module.exports = {
  name: 'queue',
  aliases: ['q'],
  description: 'Show the current music queue.',
  usage: '[page]',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const tracks = [...player.queue];
    const page = Math.max(1, parseInt(args[0]) || 1);
    const payload = buildQueueV2(player.queue.current, tracks, page);

    // Send as an ephemeral-style reply (flags: Ephemeral only works with interaction replies,
    // for prefix commands we delete the triggering message and send a DM-style or timed reply)
    const reply = await message.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });

    // Auto-delete the queue message after 60 seconds to keep chat clean
    setTimeout(() => reply.delete().catch(() => {}), 60000);

    // Delete the user's command message immediately to keep chat clean
    message.delete().catch(() => {});
  },
};
