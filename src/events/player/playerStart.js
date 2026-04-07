const { buildNowPlayingEmbed } = require('../../utils/embeds');
const { buildPlayerButtons } = require('../../utils/functions');
const config = require('../../../config');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) {
    const channelId = player.data.get('textChannel');
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    try {
      // Determine the platform emoji based on the track's source.
      // sourceName values from Lavalink/LavaSrc (e.g. 'spotify', 'youtube', 'youtubemusic').
      const sourceMap = {
        spotify: config.emojis.platforms.spotify,
        jiosaavn: config.emojis.platforms.jiosaavn,
        'apple music': config.emojis.platforms.applemusic,
        applemusic: config.emojis.platforms.applemusic,
        soundcloud: config.emojis.platforms.soundcloud,
        'amazon music': config.emojis.platforms.amazonmusic,
        amazonmusic: config.emojis.platforms.amazonmusic,
        deezer: config.emojis.platforms.deezer,
        youtube: config.emojis.platforms.youtube,
        youtubemusic: config.emojis.platforms.youtubemusic,
      };
      const sourceName = (track.sourceName || '').toLowerCase();
      const platformEmoji = sourceMap[sourceName] || config.emojis.music;

      const embed = buildNowPlayingEmbed(track, player, platformEmoji);
      const row = buildPlayerButtons(player);

      const msg = await channel.send({ embeds: [embed], components: [row] });
      // Store the now-playing message so we can edit it later (e.g. when pausing via buttons)
      player.data.set('nowPlayingMessage', msg);
    } catch (error) {
      console.error('[playerStart] Error sending now-playing embed:', error);
    }
  },
};
