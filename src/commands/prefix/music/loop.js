const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'loop',
  aliases: ['repeat'],
  description: 'Toggle loop mode for the current track or the entire queue.',
  usage: '[track|queue|off]',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.channel.send({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const valid = ['track', 'queue', 'none', 'off'];
    const arg = (args[0] || '').toLowerCase();
    let newMode;

    if (arg === 'off') {
      newMode = 'none';
    } else if (valid.includes(arg)) {
      newMode = arg;
    } else {
      // Cycle: none → track → queue → none
      const current = player.loop || 'none';
      if (current === 'none') newMode = 'track';
      else if (current === 'track') newMode = 'queue';
      else newMode = 'none';
    }

    player.setLoop(newMode);

    const modeLabels = {
      none: `${config.emojis.stop} Off`,
      track: `${config.emojis.loop} Track`,
      queue: `${config.emojis.loop} Queue`,
    };

    return message.channel.send({ embeds: [buildEmbed(`Loop mode set to **${modeLabels[newMode] || newMode}**.`)] });
  },
};
