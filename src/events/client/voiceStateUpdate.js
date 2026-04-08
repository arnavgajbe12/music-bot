/**
 * voiceStateUpdate.js
 * Handles the Discord voiceStateUpdate client event.
 *
 * Key fix: when the bot is manually removed from a voice channel by a user,
 * immediately destroy the Kazagumo player so the next !play / /play can
 * create a fresh player and actually rejoin the VC.
 *
 * Without this handler the player object lingers and subsequent play commands
 * appear to start (the bot "thinks" it's playing) but never actually join VC.
 */

const { logToWebhook } = require('../../utils/webhookLogger');

module.exports = {
  once: false,

  /**
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').VoiceState} oldState
   * @param {import('discord.js').VoiceState} newState
   */
  async run(client, oldState, newState) {
    // Only care about the bot's own voice state changes
    if (newState.member?.id !== client.user?.id) return;

    const guildId = newState.guild?.id;
    if (!guildId) return;

    // ── Bot was forcefully moved / disconnected from a voice channel ───────────
    if (oldState.channelId && !newState.channelId) {
      console.log(
        `[VoiceStateUpdate] Bot was disconnected from VC "${oldState.channelId}" in guild "${guildId}". Destroying player.`,
      );

      const player = client.manager.players.get(guildId);
      if (player) {
        try {
          await player.destroy();
          console.log(`[VoiceStateUpdate] Player destroyed for guild "${guildId}".`);
        } catch (err) {
          console.error(`[VoiceStateUpdate] Error destroying player for guild "${guildId}":`, err);
          logToWebhook({
            title: '⚠️ VoiceStateUpdate – Player Destroy Error',
            color: 0xffa500,
            fields: [
              { name: 'Guild ID', value: guildId, inline: true },
              { name: 'Old Channel', value: oldState.channelId || 'N/A', inline: true },
              { name: 'Error', value: String(err?.message || err) },
            ],
          }).catch(() => {});
        }
      }

      return;
    }

    // ── Bot was moved to a different voice channel ──────────────────────────────
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      console.log(
        `[VoiceStateUpdate] Bot was moved from VC "${oldState.channelId}" to "${newState.channelId}" in guild "${guildId}".`,
      );

      const player = client.manager.players.get(guildId);
      if (player) {
        // Update the player's stored voiceId so button checks remain correct
        player.voiceId = newState.channelId;
      }
    }
  },
};
