const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  name: 'autoplay',
  aliases: ['ap_mode'],
  description: 'Toggle autoplay — automatically fetch related tracks when the queue ends.',
  usage: '',

  async run(client, message) {
    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const settings = getSettings(message.guild.id);
    const newVal = !settings.autoplay;
    updateSettings(message.guild.id, { autoplay: newVal });

    // If a player exists, apply the setting immediately
    const player = client.manager.players.get(message.guild.id);
    if (player && typeof player.setAutoplay === 'function') {
      player.setAutoplay(newVal);
    } else if (player && player.data) {
      player.data.set('autoplay', newVal);
    }

    return message.reply({
      embeds: [
        buildEmbed(
          newVal
            ? '🔄 Autoplay is now **ON** — related tracks will play when the queue ends.'
            : '🔄 Autoplay is now **OFF**.',
        ),
      ],
    });
  },
};
