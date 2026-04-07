const { buildNowPlayingEmbed } = require('../../utils/embeds');
const { buildPlayerButtons } = require('../../utils/functions');

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
      const embed = buildNowPlayingEmbed(track, player);
      const row = buildPlayerButtons(player);

      const msg = await channel.send({ embeds: [embed], components: [row] });
      // Store the now-playing message so we can edit it later (e.g. when pausing via buttons)
      player.data.set('nowPlayingMessage', msg);
    } catch (error) {
      console.error('[playerStart] Error sending now-playing embed:', error);
    }
  },
};
