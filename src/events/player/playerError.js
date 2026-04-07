const { buildErrorEmbed } = require('../../utils/embeds');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   * @param {Error} error
   */
  async run(client, player, track, error) {
    console.error(`[playerError] Error playing "${track?.title}":`, error);

    const channelId = player.data.get('textChannel');
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    await channel
      .send({ embeds: [buildErrorEmbed(`An error occurred while playing **${track?.title || 'Unknown'}**: \`${error?.message || 'Unknown error'}\``)] })
      .catch(() => {});
  },
};
