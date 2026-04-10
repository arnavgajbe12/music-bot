const { buildNowPlayingV2, buildSetupNowPlayingV2, extractDominantColor } = require('../../utils/componentBuilder');
const { getSetup, getSettings } = require('../../utils/setupManager');
const { logTrackStart } = require('../../utils/lavalinkLogger');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) {
    const guildId = player.guildId;
    const settings = getSettings(guildId);
    const setupInfo = getSetup(guildId);

    // ── Ghost-play guard: abort if bot is not in any voice channel ────────────
    const botVoiceChannelId = client.guilds.cache.get(guildId)?.members?.me?.voice?.channelId;
    if (!botVoiceChannelId) {
      console.warn(`[playerStart] Bot is not in a voice channel for guild "${guildId}" — destroying player to prevent ghost play.`);
      player.destroy().catch(() => {});
      return;
    }

    // ── Absolute queue index tracking (item 7) ───────────────────────────────
    // Increment a never-resetting counter for each new track
    const prevIdx = player.data.get('absoluteQueueIndex') ?? 0;
    player.data.set('absoluteQueueIndex', prevIdx + 1);

    console.log(
      `[playerStart] Track started: "${track.title}" by "${track.author}" | source=${track.sourceName} | guild=${guildId} | absIdx=${prevIdx + 1}`,
    );

    // Log track start to the Lavalink channel (not the error webhook)
    logTrackStart(client, player, track).catch(() => {});

    // Extract dominant color once, reuse for all panels; prefer artworkUrl (1:1 album art)
    const artUrl = track.artworkUrl || track.thumbnail || null;
    const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
    player.data.set('accentColor', accentColor);
    player.data.set('setupQueueView', false);

    // ── Setup channel panel edit ─────────────────────────────────────────────
    if (setupInfo) {
      try {
        const setupChannel = client.channels.cache.get(setupInfo.channelId);
        if (setupChannel?.isTextBased()) {
          try {
            const setupMsg = await setupChannel.messages.fetch(setupInfo.messageId);
            if (setupMsg?.editable) {
              const payload = buildSetupNowPlayingV2(track, player, accentColor);
              await setupMsg.edit(payload);
              player.data.set('nowPlayingMessage', setupMsg);
              player.data.set('nowPlayingMessageId', setupMsg.id);
            }
          } catch {
            // Panel message was deleted – fall through to text channel
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Control message update (portable /control panel) ─────────────────────
    const controlMsgId = player.data.get('controlMessageId');
    const controlChannelId = player.data.get('controlMessageChannelId');
    if (controlMsgId && controlChannelId) {
      try {
        const controlChannel = client.channels.cache.get(controlChannelId);
        if (controlChannel?.isTextBased()) {
          const controlMsg = await controlChannel.messages.fetch(controlMsgId).catch(() => null);
          if (controlMsg?.editable) {
            const payload = buildNowPlayingV2(track, player, settings.largeArt);
            await controlMsg.edit(payload).catch(() => {});
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Normal text channel message ──────────────────────────────────────────
    if (!setupInfo) {
      const channelId = player.data.get('textChannel');
      if (!channelId) return;

      const channel = client.channels.cache.get(channelId);
      if (!channel?.isTextBased()) return;

      // Build standard now-playing payload
      const payload = buildNowPlayingV2(track, player, settings.largeArt);

      try {
        // Always send a new now-playing message for each new track
        const nowPlayingMsg = await channel.send(payload);
        player.data.set('nowPlayingMessageId', nowPlayingMsg.id);
        player.data.set('nowPlayingMessageChannelId', channel.id);
        player.data.set('nowPlayingMessage', nowPlayingMsg);
      } catch (error) {
        console.error('[playerStart] Error sending now-playing message:', error);
      }
    }

    // ── Auto-update Voice Channel Status ─────────────────────────────────────
    try {
      const voiceChannelId = player.voiceId;
      if (voiceChannelId) {
        const { resolvePlatformEmoji } = require('../../utils/embeds');
        const platformEmoji = resolvePlatformEmoji(track.sourceName);
        const titleDisplay = track.title.length > 100 ? track.title.slice(0, 97) + '...' : track.title;
        await client.rest.put(`/channels/${voiceChannelId}/voice-status`, {
          body: { status: `${platformEmoji} Playing: ${titleDisplay}` },
        });
      }
    } catch {
      // Non-fatal – bot may lack ManageChannels permission
    }
  },
};
