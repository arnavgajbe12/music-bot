module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) {
    // Clean up the now-playing message when the track ends
    const msg = player.data.get('nowPlayingMessage');
    if (msg?.deletable) {
      await msg.delete().catch(() => {});
    }
    player.data.delete('nowPlayingMessage');
  },
};
