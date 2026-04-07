const { buildErrorEmbed, buildNowPlayingEmbed } = require('../../../utils/embeds');
const { buildPlayerButtons } = require('../../../utils/functions');

module.exports = {
  name: 'nowplaying',
  aliases: ['np', 'current'],
  description: 'Show the currently playing track.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const embed = buildNowPlayingEmbed(player.queue.current, player);
    const row = buildPlayerButtons(player);

    return message.reply({ embeds: [embed], components: [row] });
  },
};
