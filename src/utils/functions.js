const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

/**
 * Search for tracks with a ytmsearch → ytsearch → scsearch fallback chain.
 * For direct URLs the query is used as-is (no prefix).
 * @param {object} manager - Kazagumo manager instance
 * @param {string} rawQuery - The raw user query
 * @param {object} requester - Discord user requesting the track
 * @returns {Promise<object|null>} Kazagumo search result, or null if nothing found
 */
async function searchWithFallback(manager, rawQuery, requester) {
  const isUrl = /^https?:\/\//i.test(rawQuery);
  if (isUrl) {
    try {
      const result = await manager.search(rawQuery, { requester });
      if (result && result.tracks && result.tracks.length > 0) return result;
    } catch {
      // fall through
    }
    return null;
  }

  const engines = ['ytmsearch:', 'ytsearch:', 'scsearch:'];
  for (const engine of engines) {
    try {
      const result = await manager.search(`${engine}${rawQuery}`, { requester });
      if (result && result.tracks && result.tracks.length > 0) return result;
    } catch {
      // try next engine
    }
  }
  return null;
}

/**
 * Build the music player control buttons (includes Loop button)
 * @param {object} player - KazagumoPlayer
 * @returns {ActionRowBuilder}
 */
function buildPlayerButtons(player) {
  const hasPrevious = player.queue.previous !== null && player.queue.previous !== undefined;
  const isPaused = player.paused;
  const isLooping = player.loop && player.loop !== 'none';

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrevious),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(isPaused ? config.emojis.play : config.emojis.pause)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('player_loop')
      .setEmoji(config.emojis.loop)
      .setStyle(isLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
}

/**
 * Build disabled player control buttons (used when queue concludes)
 * @returns {ActionRowBuilder}
 */
function buildDisabledButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(config.emojis.play)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_loop')
      .setEmoji(config.emojis.loop)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

/**
 * Check if user is in the same voice channel as the bot
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Guild} guild
 * @param {import('kazagumo').KazagumoPlayer} [player]
 * @returns {{ ok: boolean, error?: string }}
 */
function checkVoice(member, guild, player) {
  const voiceChannel = member.voice?.channel;
  if (!voiceChannel) {
    return { ok: false, error: 'You need to be in a voice channel to use this command.' };
  }
  if (player && player.voiceId && player.voiceId !== voiceChannel.id) {
    return { ok: false, error: 'You must be in the same voice channel as the bot.' };
  }
  const botMember = guild.members.me;
  if (botMember?.voice?.channel && botMember.voice.channel.id !== voiceChannel.id) {
    return { ok: false, error: 'You must be in the same voice channel as the bot.' };
  }
  return { ok: true };
}

module.exports = { buildPlayerButtons, buildDisabledButtons, checkVoice, searchWithFallback };
