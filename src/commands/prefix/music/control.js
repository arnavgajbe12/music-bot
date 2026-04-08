const { buildErrorEmbed } = require('../../../utils/embeds');
const {
  buildSetupNowPlayingV2,
  buildSetupQueueViewV2,
  buildSetupIdleV2,
  extractDominantColor,
} = require('../../../utils/componentBuilder');

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

    if (track) {
      const artUrl = track.thumbnail || track.artworkUrl || null;
      const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
      player.data.set('accentColor', accentColor);

      const isQueueView = player.data.get('setupQueueView') === true;
      if (isQueueView) {
        const tracks = [...player.queue];
        const qPage = player.data.get('setupQueuePage') || 1;
        payload = buildSetupQueueViewV2(track, tracks, qPage, accentColor, player);
      } else {
        payload = buildSetupNowPlayingV2(track, player, accentColor);
      }
    } else {
      payload = buildSetupIdleV2();
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
