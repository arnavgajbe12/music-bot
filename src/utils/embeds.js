const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

/**
 * Format milliseconds into a readable duration string
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0:00';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Build a standard embed
 * @param {string} description
 * @param {string} [title]
 * @returns {EmbedBuilder}
 */
function buildEmbed(description, title) {
  const embed = new EmbedBuilder()
    .setColor(config.embeds.color)
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/**
 * Build an error embed
 * @param {string} description
 * @returns {EmbedBuilder}
 */
function buildErrorEmbed(description) {
  return new EmbedBuilder()
    .setColor(config.embeds.errorColor)
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp()
    .setDescription(`${config.emojis.error} ${description}`);
}

/**
 * Build a Now Playing embed
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {string} [platformEmoji] - Emoji representing the source platform
 * @returns {EmbedBuilder}
 */
function buildNowPlayingEmbed(track, player, platformEmoji) {
  const thumbnail = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;
  const requester = track.requester;
  const requesterTag = requester ? `<@${requester.id}>` : 'Unknown';
  const emoji = platformEmoji || config.emojis.music;

  return new EmbedBuilder()
    .setColor(config.embeds.color)
    .setTitle(`${emoji} Now Playing`)
    .setDescription(`**[${track.title}](${track.uri})**`)
    .addFields(
      { name: 'Artist', value: track.author || 'Unknown', inline: true },
      { name: 'Duration', value: formatDuration(track.length), inline: true },
      { name: 'Requested By', value: requesterTag, inline: true },
      { name: 'Volume', value: `${player.volume}%`, inline: true },
      { name: 'Queue', value: `${player.queue.size} track(s) remaining`, inline: true },
    )
    .setImage(thumbnail)
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
}

module.exports = { formatDuration, buildEmbed, buildErrorEmbed, buildNowPlayingEmbed };
