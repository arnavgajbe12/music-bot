const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'pause',
  aliases: ['resume'],
  description: 'Pause or resume the current track.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || (!player.playing && !player.paused)) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    await player.pause(!player.paused);
    const state = player.paused ? 'paused' : 'resumed';
    const emoji = player.paused ? config.emojis.pause : config.emojis.play;

    return message.reply({
      embeds: [buildEmbed(`${emoji} The player has been **${state}**.`)],
    });
  },
};
