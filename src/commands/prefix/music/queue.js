const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildQueueV2 } = require('../../../utils/componentBuilder');

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

    const tracks = player.queue.tracks ?? [];
    const page = Math.max(1, parseInt(args[0]) || 1);
    const payload = buildQueueV2(player.queue.current, tracks, page);

    return message.reply(payload);
  },
};
