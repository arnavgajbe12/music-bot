const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'stop',
  aliases: [],
  description: 'Stop the music and clear the queue.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player) {
      return message.reply({ embeds: [buildErrorEmbed('There is no active player.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    player.queue.clear();
    await player.destroy().catch(() => {});

    return message.channel.send({
      embeds: [buildEmbed(`${config.emojis.stop} Stopped the music and cleared the queue.`)],
      allowedMentions: { repliedUser: false },
    });
  },
};
