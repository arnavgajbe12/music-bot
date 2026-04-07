module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) { // eslint-disable-line no-unused-vars
    // The now-playing message is kept alive so that playerStart (next track)
    // or playerEmpty (queue ended) can edit it.  Nothing to do here.
  },
};
