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
      return message.channel.send({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const tracks = [...player.queue];
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.max(1, Math.ceil(tracks.length / ITEMS_PER_PAGE));

    // Default to the page that contains the currently playing track
    // The currently playing track is at absolute index "absoluteQueueIndex"
    // Upcoming tracks start at position 1 in the queue array
    const requestedPage = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));

    // Pass the absolute index offset so numbers continue from where we are
    const absoluteOffset = player.data?.get('absoluteQueueIndex') ?? 1;
    const payload = buildQueueStandaloneV2(player.queue.current, tracks, requestedPage, absoluteOffset);

    // Delete the user's command message immediately to keep chat clean
    message.delete().catch(() => {});

    const reply = await message.channel.send(payload);

    // Auto-delete after 15 seconds of no interaction.
    let idleTimer = setTimeout(() => reply.delete().catch(() => {}), 15000);

    const collector = reply.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => reply.delete().catch(() => {}), 15000);
    });

    collector.on('end', () => {
      clearTimeout(idleTimer);
    });
  },
};
