const { buildNowPlayingV2 } = require('../../utils/componentBuilder');
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

    // Build the Component v2 Now Playing payload
    const payload = buildNowPlayingV2(track, player, settings.largeArt);

    // ── Setup channel panel edit ─────────────────────────────────────────────
    if (setupInfo) {
      try {
        const setupChannel = client.channels.cache.get(setupInfo.channelId);
        if (setupChannel?.isTextBased()) {
          try {
            const setupMsg = await setupChannel.messages.fetch(setupInfo.messageId);
            if (setupMsg?.editable) {
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
