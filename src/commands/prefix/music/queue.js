const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildQueueStandaloneV2 } = require('../../../utils/componentBuilder');

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
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.max(1, Math.ceil(tracks.length / ITEMS_PER_PAGE));

    // Start on the requested page (or page 1 by default)
    const requestedPage = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));
    const payload = buildQueueStandaloneV2(player.queue.current, tracks, requestedPage);

    // Delete the user's command message immediately to keep chat clean
    message.delete().catch(() => {});

    const reply = await message.channel.send(payload);

    // Auto-delete after 15 seconds of no interaction.
    // The actual button responses (nav, delete) are handled by the global interactionHandler.
    // This passive collector only manages the idle timer.
    let idleTimer = setTimeout(() => reply.delete().catch(() => {}), 15000);

    const collector = reply.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', () => {
      // Reset idle timer on any button press
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => reply.delete().catch(() => {}), 15000);
    });

    collector.on('end', () => {
      clearTimeout(idleTimer);
    });
  },
};
