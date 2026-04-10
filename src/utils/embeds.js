const { EmbedBuilder } = require('discord.js');
const config = require('../../config');

/**
 * Format milliseconds into a readable duration string (mm:ss or h:mm:ss)
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
 * Resolve the platform emoji from a raw source name
 * @param {string} sourceName
 * @returns {string}
 */
function resolvePlatformEmoji(sourceName) {
  const sourceMap = {
    spotify: config.emojis.platforms.spotify,
    jiosaavn: config.emojis.platforms.jiosaavn,
    'apple music': config.emojis.platforms.applemusic,
    applemusic: config.emojis.platforms.applemusic,
    soundcloud: config.emojis.platforms.soundcloud,
    'amazon music': config.emojis.platforms.amazonmusic,
    amazonmusic: config.emojis.platforms.amazonmusic,
    deezer: config.emojis.platforms.deezer,
    youtube: config.emojis.platforms.youtube,
    youtubemusic: config.emojis.platforms.youtubemusic,
  };
  return sourceMap[(sourceName || '').toLowerCase()] || config.emojis.music;
}

/**
 * Resolve a human-readable display name for a source platform
 * @param {string} sourceName
 * @returns {string}
 */
function resolveSourceDisplayName(sourceName) {
  const displayNames = {
    spotify: 'Spotify',
    jiosaavn: 'JioSaavn',
    'apple music': 'Apple Music',
    applemusic: 'Apple Music',
    soundcloud: 'SoundCloud',
    'amazon music': 'Amazon Music',
    amazonmusic: 'Amazon Music',
    deezer: 'Deezer',
    youtube: 'YouTube',
    youtubemusic: 'YouTube Music',
  };
  const key = (sourceName || '').toLowerCase();
  return displayNames[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown');
}

/**
 * Build the "Now Playing" embed (stylized layout)
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {string} [platformEmoji] - Emoji representing the source platform
 * @returns {EmbedBuilder}
 */
function buildNowPlayingEmbed(track, player, platformEmoji) {
  const thumbnail = track.artworkUrl || track.thumbnail || config.images.defaultThumbnail;
  const requester = track.requester;
  const requesterTag = requester ? `<@${requester.id}>` : 'Unknown';
  const emoji = platformEmoji || config.emojis.music;
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const loopMode = player.loop && player.loop !== 'none'
    ? ` ${config.emojis.loop} \`${player.loop}\``
    : '';

  return new EmbedBuilder()
    .setColor(config.embeds.color)
    .setAuthor({ name: `${emoji} Now Playing${loopMode}` })
    .setTitle(track.title)
    .setURL(track.uri || null)
    .addFields(
      { name: '🎤 Artist', value: track.author || 'Unknown', inline: true },
      { name: '⏱️ Duration', value: formatDuration(track.length), inline: true },
      { name: `${emoji} Source`, value: sourceDisplay, inline: true },
      { name: '👤 Requested By', value: requesterTag, inline: true },
      { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
      { name: '📋 Up Next', value: player.queue.size > 0 ? `${player.queue.size} track(s)` : 'Nothing', inline: true },
    )
    .setThumbnail(thumbnail)
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
}

/**
 * Build the "Queue Concluded" embed shown when the queue is empty
 * @returns {EmbedBuilder}
 */
function buildQueueConcludedEmbed() {
  return new EmbedBuilder()
    .setColor(config.embeds.color)
    .setAuthor({ name: '⏹️ Queue Concluded' })
    .setTitle('The queue has ended')
    .setDescription('All tracks have been played. Use `/play` to add more music!')
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
}

module.exports = {
  formatDuration,
  buildEmbed,
  buildErrorEmbed,
  resolvePlatformEmoji,
  resolveSourceDisplayName,
  buildNowPlayingEmbed,
  buildQueueConcludedEmbed,
};
