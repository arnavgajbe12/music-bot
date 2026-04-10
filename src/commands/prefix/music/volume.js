const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'volume',
  aliases: ['vol'],
  description: 'Set the player volume (1-200).',
  usage: '<1-200>',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player) {
      return message.channel.send({ embeds: [buildErrorEmbed('There is no active player.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    if (!args[0]) {
      return message.channel.send({
        embeds: [buildEmbed(`${config.emojis.volumeUp} Current volume: **${player.volume}%**`)],
      });
    }

    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 1 || vol > 200) {
      return message.channel.send({ embeds: [buildErrorEmbed('Please provide a volume between **1** and **200**.')] });
    }

    const prevVol = player.volume;
    await player.setVolume(vol);

    return message.channel.send({
      embeds: [buildEmbed(`${vol > prevVol ? config.emojis.volumeUp : config.emojis.volumeDown} Volume set to **${vol}%**.`)],
    });
  },
};
