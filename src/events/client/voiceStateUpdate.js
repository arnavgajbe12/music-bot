/**
 * voiceStateUpdate.js
 * Handles the Discord voiceStateUpdate client event.
 *
 * Key fix: when the bot is manually removed from a voice channel by a user,
 * immediately destroy the Kazagumo player AND release Shoukaku's internal
 * WebRTC session so the next !play / /play can create a fresh player and
 * actually rejoin the VC.
 *
 * Without fully releasing the Shoukaku session the Lavalink node still holds
 * a "connected" ghost session even after Kazagumo's player map is cleared,
 * causing the bot to ghost-play without being in a channel.
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
        // Skip destroying if the disconnect was triggered intentionally (by a command)
        if (player.data.get('intentionalDisconnect')) {
          console.log(`[VoiceStateUpdate] Intentional disconnect detected — skipping double-destroy.`);
          player.data.delete('intentionalDisconnect');
          return;
        }
        try {
          // Explicitly release Shoukaku's internal WebRTC session BEFORE destroying
          // the Kazagumo player. Without this the Lavalink node keeps a ghost
          // "connected" session even after the Kazagumo player map is cleared,
          // which causes ghost-playing and prevents rejoining the VC.
          try {
            const shoukakuPlayer = player.shoukaku;
            if (shoukakuPlayer) {
              // destroyPlayer tells the Lavalink node to drop its session for this guild
              await shoukakuPlayer.node.destroyPlayer(guildId).catch(() => {});
              // leaveVoiceChannel sends the Discord gateway VOICE_STATE_UPDATE to
              // instruct Discord's servers to fully release the WebRTC session
              await client.manager.shoukaku.leaveVoiceChannel(guildId).catch(() => {});
            }
          } catch {
            // Non-fatal – continue with Kazagumo destroy regardless
          }
          await player.destroy();
          client.manager.players.delete(guildId);
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
