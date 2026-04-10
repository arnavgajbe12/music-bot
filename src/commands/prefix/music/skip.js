const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'skip',
  aliases: ['s'],
  description: 'Skip the current track.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.playing) {
      return message.channel.send({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const currentTitle = player.queue.current?.title || 'Unknown';
    await player.skip();

    return message.channel.send({
      embeds: [buildEmbed(`${config.emojis.skip} Skipped **${currentTitle}**.`)],
    });
  },
};
