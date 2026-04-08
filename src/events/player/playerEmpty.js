const { buildIdleV2, buildSetupIdleV2 } = require('../../utils/componentBuilder');
const { getSetup, getSettings } = require('../../utils/setupManager');
const { searchWithFallback } = require('../../utils/functions');
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

    // ── Autoplay ──────────────────────────────────────────────────────────────
    const autoplayEnabled = settings.autoplay || player.data.get('autoplay') === true;
    if (autoplayEnabled) {
      const lastTrack = player.data.get('lastTrack');
      if (lastTrack) {
        try {
          // Search for a related track using the last played song's artist/title
          const query = `${lastTrack.title} ${lastTrack.author || ''}`.trim();
          const result = await searchWithFallback(client.manager, query, {
            id: 'autoplay',
            username: 'Autoplay',
            displayName: 'Autoplay',
          });

          if (result && result.tracks && result.tracks.length > 0) {
            // Prefer a track that is not the exact same URI as the last played one
            const candidate =
              result.tracks.find((t) => t.uri !== lastTrack.uri) || result.tracks[1] || result.tracks[0];

            if (candidate) {
              player.queue.add(candidate);
              if (!player.playing && !player.paused) {
                await player.play();
              }
              return; // autoplay kicked in – don't show idle panel
            }
          }
        } catch (err) {
          console.error('[playerEmpty] Autoplay search error:', err);
          // Fall through to idle panel
        }
      }
    }

    // ── Idle panel ────────────────────────────────────────────────────────────
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
