const { buildNowPlayingV2, buildSetupNowPlayingV2, extractDominantColor } = require('../../utils/componentBuilder');
const { getSetup, getSettings } = require('../../utils/setupManager');

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

    // ── Store last track for autoplay ────────────────────────────────────────
    player.data.set('lastTrack', track);

    // ── Setup channel panel edit ─────────────────────────────────────────────
    if (setupInfo) {
      try {
        const setupChannel = client.channels.cache.get(setupInfo.channelId);
        if (setupChannel?.isTextBased()) {
          try {
            const setupMsg = await setupChannel.messages.fetch(setupInfo.messageId);
            if (setupMsg?.editable) {
              // Extract dominant color from the thumbnail asynchronously
              const artUrl = track.thumbnail || track.artworkUrl || null;
              const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
              // Cache accent color and reset queue view when a new track starts
              player.data.set('accentColor', accentColor);
              player.data.set('setupQueueView', false);
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

    // ── Normal text channel message ──────────────────────────────────────────
    if (!setupInfo) {
      const channelId = player.data.get('textChannel');
      if (!channelId) return;

      const channel = client.channels.cache.get(channelId);
      if (!channel?.isTextBased()) return;

      // Build standard now-playing payload
      const payload = buildNowPlayingV2(track, player, settings.largeArt);

      try {
        const existingMsgId = player.data.get('nowPlayingMessageId');
        let nowPlayingMsg = null;

        if (existingMsgId) {
          try {
            const fetched = await channel.messages.fetch(existingMsgId);
            if (fetched?.editable) {
              await fetched.edit(payload);
              nowPlayingMsg = fetched;
            }
          } catch {
            // Message gone – send a new one
          }
        }

        if (!nowPlayingMsg) {
          nowPlayingMsg = await channel.send(payload);
          player.data.set('nowPlayingMessageId', nowPlayingMsg.id);
          player.data.set('nowPlayingMessageChannelId', channel.id);
        }

        player.data.set('nowPlayingMessage', nowPlayingMsg);
      } catch (error) {
        console.error('[playerStart] Error updating now-playing message:', error);
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
