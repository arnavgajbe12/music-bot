const { buildIdleV2 } = require('../../utils/componentBuilder');
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
    const payload = buildIdleV2(config.images.defaultThumbnail, settings.largeArt);

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
