const { buildNowPlayingEmbed, resolvePlatformEmoji } = require('../../utils/embeds');
const { buildPlayerButtons } = require('../../utils/functions');

module.exports = {
  /**
   * @param {import('discord.js').Client} client
   * @param {import('kazagumo').KazagumoPlayer} player
   * @param {import('kazagumo').KazagumoTrack} track
   */
  async run(client, player, track) {
    const channelId = player.data.get('textChannel');
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return;

    try {
      const platformEmoji = resolvePlatformEmoji(track.sourceName);
      const embed = buildNowPlayingEmbed(track, player, platformEmoji);
      const row = buildPlayerButtons(player);

      // Try to edit the existing now-playing message instead of spamming new ones
      const existingMsgId = player.data.get('nowPlayingMessageId');
      let nowPlayingMsg = null;

      if (existingMsgId) {
        try {
          const fetched = await channel.messages.fetch(existingMsgId);
          if (fetched?.editable) {
            await fetched.edit({ embeds: [embed], components: [row] });
            nowPlayingMsg = fetched;
          }
        } catch {
          // Message was deleted or not fetchable – fall through to send a new one
        }
      }

      if (!nowPlayingMsg) {
        nowPlayingMsg = await channel.send({ embeds: [embed], components: [row] });
        player.data.set('nowPlayingMessageId', nowPlayingMsg.id);
      }

      // Keep a soft reference to the message for immediate edits (e.g. button presses)
      player.data.set('nowPlayingMessage', nowPlayingMsg);

      // ── Auto-update Voice Channel Status ────────────────────────────────
      try {
        const voiceChannelId = player.voiceId;
        if (voiceChannelId) {
          await client.rest.put(`/channels/${voiceChannelId}/voice-status`, {
            body: { status: `🎵 Playing: ${track.title}` },
          });
        }
      } catch {
        // Non-fatal – bot may lack ManageChannels permission
      }
    } catch (error) {
      console.error('[playerStart] Error updating now-playing message:', error);
    }
  },
};
