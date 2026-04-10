const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'move',
  aliases: [],
  description: 'Move a song from one position to another in the queue.',
  usage: '<from> <to>',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.channel.send({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const from = parseInt(args[0], 10);
    const to = parseInt(args[1], 10);

    if (!args[0] || !args[1] || isNaN(from) || isNaN(to) || from < 1 || to < 1) {
      return message.channel.send({ embeds: [buildErrorEmbed('Usage: `!move <from> <to>` — both must be positive numbers.')] });
    }

    const tracks = [...player.queue];

    if (from > tracks.length || to > tracks.length) {
      return message.channel.send({ embeds: [buildErrorEmbed(`Queue only has **${tracks.length}** track(s). Both positions must be within range.`)] });
    }

    if (from === to) {
      return message.channel.send({ embeds: [buildErrorEmbed('Source and destination positions are the same.')] });
    }

    // Remove the track from its original position and insert at the new position
    const [movedTrack] = tracks.splice(from - 1, 1);
    tracks.splice(to - 1, 0, movedTrack);

    // Replace queue contents
    player.queue.splice(0, player.queue.length, ...tracks);

    return message.channel.send({
      embeds: [buildEmbed(`${config.emojis.queue} Moved **${movedTrack.title}** from position #${from} to #${to}.`)],
    });
  },
};
