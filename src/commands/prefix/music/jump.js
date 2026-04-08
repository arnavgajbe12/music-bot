const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'jump',
  aliases: [],
  description: 'Jump to a specific song number in the queue.',
  usage: '<song number>',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const num = parseInt(args[0], 10);
    if (!args[0] || isNaN(num) || num < 1) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a valid song number. Usage: `!jump <number>`')] });
    }

    const tracks = [...player.queue];
    if (num > tracks.length) {
      return message.reply({ embeds: [buildErrorEmbed(`There are only **${tracks.length}** track(s) in the queue after the current song.`)] });
    }

    // Move the target track to the front of the queue, then skip to it
    // tracks[0] is the next song (position 1), tracks[num-1] is the target
    const target = tracks[num - 1];
    player.queue.splice(num - 1, 1);
    player.queue.unshift(target);

    // Skip the current song to start playing the target
    await player.skip();

    return message.reply({
      embeds: [buildEmbed(`${config.emojis.skip} Jumped to **${target.title}** (position #${num}).`)],
    });
  },
};
