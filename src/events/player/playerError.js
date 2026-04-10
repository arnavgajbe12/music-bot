const { buildErrorEmbed } = require('../../utils/embeds');
const { logToWebhook } = require('../../utils/webhookLogger');
const { logPlayerError } = require('../../utils/lavalinkLogger');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   * @param {Error} error
   */
  async run(client, player, track, error) {
    console.error(`[playerError] Error playing "${track?.title}":`, error);

    // Route to Lavalink log channel if configured, otherwise fall back to error webhook
    if (process.env.LAVALINK_LOG_CHANNEL_ID) {
      await logPlayerError(client, player, track, error).catch(() => {});
    } else {
      await logToWebhook({
        title: '🚨 Player Error',
        color: 0xed4245,
        fields: [
          { name: 'Guild ID', value: player?.guildId || 'N/A', inline: true },
          { name: 'Track', value: track?.title ? `${track.title} — ${track.author || 'Unknown'}` : 'N/A', inline: false },
          { name: 'Error', value: String(error?.message || error) },
          { name: 'Stack', value: (error?.stack || 'N/A').slice(0, 900) },
        ],
      });
    }

    // Skip error message if this was an intentional disconnect/destroy
    if (player.data?.get('intentionalDisconnect')) return;

    const channelId = player.data.get('textChannel');
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    await channel
      .send({ embeds: [buildErrorEmbed(`An error occurred while playing **${track?.title || 'Unknown'}**: \`${error?.message || 'Unknown error'}\``)] })
      .catch(() => {});
  },
};
