module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) { // eslint-disable-line no-unused-vars
    // Delete any /nowplaying command messages that were tracking this song
    const nowPlayingCmdMessages = player.data.get('nowPlayingCmdMessages');
    if (nowPlayingCmdMessages && nowPlayingCmdMessages.length > 0) {
      for (const msg of nowPlayingCmdMessages) {
        msg.delete().catch(() => {});
      }
      player.data.delete('nowPlayingCmdMessages');
    }
  },
};
