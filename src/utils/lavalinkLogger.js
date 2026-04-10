/**
 * lavalinkLogger.js
 * Sends Lavalink-related events (track start, node info, player errors) as
 * rich embeds to the designated LAVALINK_LOG_CHANNEL_ID channel.
 * Falls back to console.log if the channel is not configured.
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { formatDuration } = require('./embeds');

/**
 * Send a Lavalink log embed to the designated channel.
 * If LAVALINK_LOG_CHANNEL_ID is not set, this is a no-op (no fallback to error webhook).
 *
 * @param {import('discord.js').Client} client
 * @param {object} options
 * @param {string}   options.title       - Embed title
 * @param {string}   [options.description] - Main body text
 * @param {number}   [options.color]     - Integer color
 * @param {Array}    [options.fields]    - Embed fields
 * @param {string}   [options.thumbnailUrl] - Thumbnail URL (track art)
 * @returns {Promise<void>}
 */
async function logToLavalinkChannel(client, { title, description, color, fields = [], thumbnailUrl } = {}) {
  const channelId = process.env.LAVALINK_LOG_CHANNEL_ID;
  if (!channelId || !client) return;

  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle((title || 'Lavalink Event').slice(0, 256))
      .setColor(color != null ? color : config.embeds.color)
      .setTimestamp()
      .setFooter({ text: config.embeds.footerText });

    if (description) embed.setDescription(description.slice(0, 4096));

    if (thumbnailUrl) {
      try { embed.setThumbnail(thumbnailUrl); } catch { /* invalid url */ }
    }

    if (fields.length > 0) {
      embed.addFields(
        fields.slice(0, 25).map((f) => ({
          name: (f.name || 'Info').slice(0, 256),
          value: (String(f.value) || 'N/A').slice(0, 1024),
          inline: f.inline || false,
        })),
      );
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[LavalinkLogger] Failed to send log to channel:', err.message);
  }
}

/**
 * Log a track-start event to the Lavalink channel.
 * @param {import('discord.js').Client} client
 * @param {object} player - KazagumoPlayer
 * @param {object} track - KazagumoTrack
 */
async function logTrackStart(client, player, track) {
  const artUrl = track.thumbnail || track.artworkUrl || null;
  return logToLavalinkChannel(client, {
    title: '▶️ Track Started',
    color: 0x57f287,
    thumbnailUrl: artUrl,
    fields: [
      { name: 'Guild', value: player.guildId, inline: true },
      { name: 'Source', value: track.sourceName || 'Unknown', inline: true },
      { name: 'Track', value: `${track.title} — ${track.author || 'Unknown'}`, inline: false },
      { name: 'Duration', value: formatDuration(track.length), inline: true },
      { name: 'URI', value: track.uri || 'N/A', inline: false },
    ],
  });
}

/**
 * Log a player error to the Lavalink channel.
 * @param {import('discord.js').Client} client
 * @param {object} player - KazagumoPlayer
 * @param {object} track - KazagumoTrack
 * @param {Error} error
 */
async function logPlayerError(client, player, track, error) {
  return logToLavalinkChannel(client, {
    title: '🚨 Player Error',
    color: 0xed4245,
    fields: [
      { name: 'Guild', value: player?.guildId || 'N/A', inline: true },
      { name: 'Track', value: track?.title ? `${track.title} — ${track.author || 'Unknown'}` : 'N/A', inline: false },
      { name: 'Error', value: String(error?.message || error).slice(0, 1024), inline: false },
    ],
  });
}

module.exports = { logToLavalinkChannel, logTrackStart, logPlayerError };
