/**
 * panelUpdater.js
 * Manages the sticky/persistent Now Playing message that follows the music bot.
 *
 * updateNowPlayingMessage — Edits the existing NP message in place if it is still
 *   visible, or sends a fresh one when the old one has been buried by BURY_THRESHOLD
 *   new messages in the same channel.
 *
 * incrementBuryCount — Called from messageCreate for every non-bot message that
 *   lands in the same channel as the current NP message, so we know when to resend.
 */

const BURY_THRESHOLD = 5;

/**
 * Send or update the Now Playing message for the given player.
 *
 * @param {import('discord.js').Client} client
 * @param {import('kazagumo').KazagumoPlayer} player
 * @param {object} payload  - The Component v2 message payload to send/edit
 * @param {string} channelId - The text channel to send in
 */
async function updateNowPlayingMessage(client, player, payload, channelId) {
  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased()) return;

  const existingMsgId = player.data.get('nowPlayingMessageId');
  const existingChannelId = player.data.get('nowPlayingMessageChannelId');
  const buryCount = player.data.get('npBuryCount') ?? 0;

  // Try to edit in place if the message is in the same channel and not buried
  if (existingMsgId && existingChannelId === channelId && buryCount < BURY_THRESHOLD) {
    try {
      const existingChannel = client.channels.cache.get(existingChannelId);
      if (existingChannel?.isTextBased()) {
        const existingMsg = await existingChannel.messages.fetch(existingMsgId).catch(() => null);
        if (existingMsg?.editable) {
          await existingMsg.edit(payload);
          player.data.set('npBuryCount', 0);
          return;
        }
      }
    } catch {
      // Fall through to sending a new message
    }
  }

  // Delete old message if it still exists (channel changed or buried)
  if (existingMsgId && existingChannelId) {
    try {
      const oldChannel = client.channels.cache.get(existingChannelId);
      if (oldChannel?.isTextBased()) {
        const oldMsg = await oldChannel.messages.fetch(existingMsgId).catch(() => null);
        // Deletion failures (message already removed, missing permissions) are safe to ignore
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
    } catch {
      // Non-fatal — stale message reference, channel deleted, or missing permissions
    }
  }

  // Send a fresh Now Playing message
  try {
    const newMsg = await channel.send(payload);
    player.data.set('nowPlayingMessageId', newMsg.id);
    player.data.set('nowPlayingMessageChannelId', channel.id);
    player.data.set('nowPlayingMessage', newMsg);
    player.data.set('npBuryCount', 0);
  } catch (err) {
    console.error('[panelUpdater] Failed to send Now Playing message:', err);
  }
}

/**
 * Increment the bury counter for the guild's current NP message.
 * Only increments when the message was sent in the same channel as the new message.
 *
 * @param {import('kazagumo').KazagumoPlayer} player
 * @param {string} messageChannelId - The channel where the new (non-bot) message was sent
 */
function incrementBuryCount(player, messageChannelId) {
  const npChannelId = player.data.get('nowPlayingMessageChannelId');
  if (!npChannelId || npChannelId !== messageChannelId) return;

  const current = player.data.get('npBuryCount') ?? 0;
  player.data.set('npBuryCount', current + 1);
}

module.exports = { updateNowPlayingMessage, incrementBuryCount };
