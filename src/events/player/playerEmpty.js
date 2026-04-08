const { buildIdleV2, buildSetupIdleV2 } = require('../../utils/componentBuilder');
const { getSetup, getSettings } = require('../../utils/setupManager');
const config = require('../../../config');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   */
  async run(client, player) {
    const guildId = player.guildId;
    const settings = getSettings(guildId);
    const setupInfo = getSetup(guildId);

    // ── Autoplay: enqueue a related track when queue runs out ────────────────
    if (settings.autoplay) {
      const lastTrack = Array.isArray(player.queue.previous) && player.queue.previous.length > 0
        ? player.queue.previous[0]
        : null;

      if (lastTrack) {
        try {
          // Search for a related track using the last played track's artist + title
          const searchQuery = `ytmsearch:${lastTrack.author || ''} ${lastTrack.title}`.trim();
          const result = await client.manager.search(searchQuery, { requester: lastTrack.requester });
          if (result && result.tracks && result.tracks.length > 0) {
            // Prefer a track that isn't an exact duplicate
            const candidates = result.tracks.filter(
              (t) => !(t.title === lastTrack.title && t.author === lastTrack.author),
            );
            const autoTrack = candidates.length > 0
              ? candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))]
              : result.tracks[0];
            player.queue.add(autoTrack);
            await player.play();
            return; // playerStart will handle panel updates
          }
        } catch (err) {
          console.error('[playerEmpty] Autoplay search failed:', err);
        }
      }
    }

    // Choose idle payload based on whether a setup panel exists
    const payload = setupInfo
      ? buildSetupIdleV2()
      : buildIdleV2(config.images.defaultThumbnail, settings.largeArt);

    // Edit the now-playing message / setup panel to idle state
    const msg = player.data.get('nowPlayingMessage');
    if (msg?.editable) {
      await msg.edit(payload).catch(() => {});
    } else if (setupInfo) {
      // Re-fetch setup panel if soft ref is gone
      try {
        const setupChannel = client.channels.cache.get(setupInfo.channelId);
        if (setupChannel?.isTextBased()) {
          const setupMsg = await setupChannel.messages.fetch(setupInfo.messageId).catch(() => null);
          if (setupMsg?.editable) await setupMsg.edit(payload).catch(() => {});
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Update the portable /control message to idle state ───────────────────
    const controlMsgId = player.data.get('controlMessageId');
    const controlChannelId = player.data.get('controlMessageChannelId');
    if (controlMsgId && controlChannelId) {
      try {
        const controlChannel = client.channels.cache.get(controlChannelId);
        if (controlChannel?.isTextBased()) {
          const controlMsg = await controlChannel.messages.fetch(controlMsgId).catch(() => null);
          if (controlMsg?.editable) await controlMsg.edit(buildSetupIdleV2()).catch(() => {});
        }
      } catch {
        // Non-fatal
      }
    }

    // Clear VC status
    try {
      if (player.voiceId) {
        await client.rest.put(`/channels/${player.voiceId}/voice-status`, {
          body: { status: '' },
        });
      }
    } catch {
      // Non-fatal
    }

    // Clean up stored references
    player.data.delete('nowPlayingMessage');
    player.data.delete('nowPlayingMessageId');

    // Respect 24/7 mode – if enabled, never destroy the player
    if (settings.mode247) return;

    if (config.player.leaveOnEmpty) {
      setTimeout(() => {
        if (!player.playing && player.queue.size === 0) {
          player.destroy().catch(() => {});
        }
      }, 5000);
    }
  },
};
