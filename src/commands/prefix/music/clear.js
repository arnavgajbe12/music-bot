const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'clear',
  aliases: ['clearqueue', 'cq'],
  description: 'Clear all upcoming tracks from the queue.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const count = player.queue.length;
    if (count === 0) {
      return message.reply({ embeds: [buildErrorEmbed('The queue is already empty.')] });
    }

    player.queue.clear();

    return message.reply({
      embeds: [buildEmbed(`${config.emojis.stop} Cleared **${count}** track(s) from the queue.`)],
    });
  },
};
