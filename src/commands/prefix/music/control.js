const { buildErrorEmbed } = require('../../../utils/embeds');
const {
  buildNowPlayingV2,
  buildQueueV2,
  buildIdleV2,
  extractDominantColor,
} = require('../../../utils/componentBuilder');
const { getSettings } = require('../../../utils/setupManager');

module.exports = {
  name: 'control',
  aliases: ['ctrl'],
  description: 'Send a portable music control panel that stays updated.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);

    if (!player) {
      return message.reply({ embeds: [buildErrorEmbed('There is no active player. Start playing a song first.')] });
    }

    let payload;
    const track = player.queue.current;
    const settings = getSettings(message.guild.id);

    if (track) {
      const artUrl = track.artworkUrl || track.thumbnail || null;
      const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
      player.data.set('accentColor', accentColor);
      payload = buildNowPlayingV2(track, player, settings.largeArt);
    } else {
      payload = buildIdleV2(null, settings.largeArt);
    }

    // Delete the old control message if one exists
    const oldControlId = player.data.get('controlMessageId');
    const oldControlChannelId = player.data.get('controlMessageChannelId');
    if (oldControlId && oldControlChannelId) {
      const oldChannel = client.channels.cache.get(oldControlChannelId);
      if (oldChannel?.isTextBased()) {
        oldChannel.messages.fetch(oldControlId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
      }
    }

    const msg = await message.channel.send(payload);
    player.data.set('controlMessageId', msg.id);
    player.data.set('controlMessageChannelId', message.channel.id);

    // Auto-delete the command invocation message to keep things clean
    message.delete().catch(() => {});
  },
};
