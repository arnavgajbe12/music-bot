const config = require('../../../config');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   */
  async run(client, player) {
    const channelId = player.data.get('textChannel');
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    await channel
      .send(`${config.emojis.music} The queue has ended. See you next time!`)
      .catch(() => {});

    if (config.player.leaveOnEmpty) {
      setTimeout(() => {
        // Only destroy if still empty and not playing
        if (!player.playing && player.queue.size === 0) {
          player.destroy().catch(() => {});
        }
      }, 5000);
    }
  },
};
