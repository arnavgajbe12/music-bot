const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const { logToWebhook } = require('./webhookLogger');

/**
 * Search for tracks with a ytmsearch → ytsearch → scsearch fallback chain.
 * For direct URLs the query is used as-is (no prefix).
 * Verbose console + webhook logging is included to help diagnose search failures.
 * @param {object} manager - Kazagumo manager instance
 * @param {string} rawQuery - The raw user query
 * @param {object} requester - Discord user requesting the track
 * @returns {Promise<object|null>} Kazagumo search result, or null if nothing found
 */
async function searchWithFallback(manager, rawQuery, requester) {
  const isUrl = /^https?:\/\//i.test(rawQuery);

  if (isUrl) {
    console.log(`[searchWithFallback] URL query detected: "${rawQuery}"`);
    try {
      const result = await manager.search(rawQuery, { requester });
      console.log(
        `[searchWithFallback] URL result → type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`,
      );
      if (result && result.tracks && result.tracks.length > 0) return result;
    } catch (err) {
      console.error(`[searchWithFallback] URL search threw:`, err?.message || err);
    }
    console.warn(`[searchWithFallback] URL search returned no tracks for: "${rawQuery}"`);
    return null;
  }

  // Pass the source prefix via options.source so Kazagumo does NOT prepend its own prefix
  // on top of the one we already specify. Passing it in the query string causes
  // Kazagumo to produce "ytsearch:ytmsearch:query" → no results from Lavalink.
  const sources = ['ytmsearch:', 'ytsearch:', 'scsearch:'];
  for (const source of sources) {
    try {
      console.log(`[searchWithFallback] Trying source "${source}" → rawQuery: "${rawQuery}"`);
      const result = await manager.search(rawQuery, { requester, source });
      console.log(
        `[searchWithFallback] Result for "${source}" → type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`,
      );
      if (result && result.tracks && result.tracks.length > 0) {
        console.log(`[searchWithFallback] ✅ Found ${result.tracks.length} track(s) via "${source}"`);
        return result;
      }
    } catch (err) {
      console.error(`[searchWithFallback] Source "${source}" threw:`, err?.message || err);
      // Log failures to webhook so we can diagnose remote Lavalink issues
      await logToWebhook({
        title: '⚠️ Search Engine Exception',
        color: 0xffa500,
        fields: [
          { name: 'Source', value: source, inline: true },
          { name: 'Query', value: rawQuery, inline: true },
          { name: 'Error', value: String(err?.message || err) },
        ],
      }).catch(() => {});
    }
  }

  console.warn(`[searchWithFallback] ❌ All sources exhausted – no results for: "${rawQuery}"`);
  await logToWebhook({
    title: '❌ Search – No Results from Any Engine',
    color: 0xed4245,
    fields: [
      { name: 'Query', value: rawQuery },
      { name: 'Sources Tried', value: sources.join(', ') },
      { name: 'Requester', value: requester?.username || String(requester?.id) || 'Unknown' },
    ],
  }).catch(() => {});

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
