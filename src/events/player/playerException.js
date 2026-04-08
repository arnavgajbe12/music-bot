/**
 * playerException.js
 * Handles the Kazagumo "playerException" event.
 * Fires when Lavalink encounters an error while playing a track.
 * Logs the error verbosely to console and to the error webhook.
 */

const { buildErrorEmbed } = require('../../utils/embeds');
const { logToWebhook } = require('../../utils/webhookLogger');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   * @param {object} data - Exception data from Lavalink
   */
  async run(client, player, track, data) {
    const errorMsg = data?.message || data?.error || JSON.stringify(data) || 'Unknown exception';
    const severity = data?.severity || 'UNKNOWN';

    console.error(
      `[playerException] Exception while playing "${track?.title}" in guild "${player?.guildId}". Severity: ${severity}. Message: ${errorMsg}`,
    );

    // Send detailed embed to webhook
    await logToWebhook({
      title: '🚨 Player Exception',
      color: 0xed4245,
      fields: [
        { name: 'Guild ID', value: player?.guildId || 'N/A', inline: true },
        { name: 'Severity', value: severity, inline: true },
        { name: 'Track', value: track?.title ? `${track.title} — ${track.author || 'Unknown'}` : 'N/A', inline: false },
        { name: 'Source', value: track?.sourceName || 'N/A', inline: true },
        { name: 'URI', value: track?.uri || 'N/A', inline: false },
        { name: 'Error', value: errorMsg },
      ],
    });

    // Notify the text channel
    const channelId = player?.data?.get('textChannel');
    if (channelId) {
      const channel = client.channels.cache.get(channelId);
      if (channel?.isTextBased()) {
        await channel
          .send({
            embeds: [
              buildErrorEmbed(
                `A player exception occurred while playing **${track?.title || 'Unknown'}**.\n\`${errorMsg}\``,
              ),
            ],
          })
          .catch(() => {});
      }
    }
  },
};
