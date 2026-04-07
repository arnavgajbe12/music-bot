const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'remove',
  aliases: ['rm'],
  description: 'Remove a specific track from the queue by its position.',
  usage: '<position>',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const position = parseInt(args[0], 10);
    if (!args[0] || isNaN(position) || position < 1) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a valid position number (e.g. `!remove 2`).')] });
    }

    const tracks = player.queue.tracks ?? [];
    if (position > tracks.length) {
      return message.reply({
        embeds: [buildErrorEmbed(`Position **${position}** is out of range. The queue has **${tracks.length}** track(s).`)],
      });
    }

    const removed = tracks.splice(position - 1, 1)[0];

    return message.reply({
      embeds: [buildEmbed(`${config.emojis.stop} Removed **[${removed.title}](${removed.uri})** from position **${position}**.`)],
    });
  },
};
