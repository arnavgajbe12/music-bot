const { buildQueueConcludedEmbed } = require('../../utils/embeds');
const { buildDisabledButtons } = require('../../utils/functions');
const config = require('../../../config');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   */
  async run(client, player) {
    // Edit the now-playing message to show "Queue Concluded" with disabled buttons
    const msg = player.data.get('nowPlayingMessage');
    const disabledRow = buildDisabledButtons();
    const concludedEmbed = buildQueueConcludedEmbed();

    if (msg?.editable) {
      await msg.edit({ embeds: [concludedEmbed], components: [disabledRow] }).catch(() => {});
    } else {
      // Fallback: if message is gone, post a short notice
      const channelId = player.data.get('textChannel');
      const channel = channelId ? client.channels.cache.get(channelId) : null;
      if (channel?.isTextBased()) {
        await channel
          .send(`${config.emojis.music} The queue has ended. See you next time!`)
          .catch(() => {});
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

    if (config.player.leaveOnEmpty) {
      setTimeout(() => {
        if (!player.playing && player.queue.size === 0) {
          player.destroy().catch(() => {});
        }
      }, 5000);
    }
  },
};
