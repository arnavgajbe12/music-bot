const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'shuffle',
  description: 'Shuffle the upcoming tracks in the queue.',
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

    const tracks = player.queue.tracks ?? [];
    if (tracks.length < 2) {
      return message.reply({ embeds: [buildErrorEmbed('There are not enough tracks in the queue to shuffle.')] });
    }

    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return message.reply({
      embeds: [buildEmbed(`${config.emojis.shuffle} Shuffled **${tracks.length}** tracks in the queue.`)],
    });
  },
};
