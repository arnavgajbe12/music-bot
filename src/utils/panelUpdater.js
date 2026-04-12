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

/**
 * Send or update the portable control panel for the given player.
 * If an existing control message is in the same channel and still editable, it is
 * updated in-place; otherwise the old one is deleted and a fresh panel is sent.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').TextBasedChannel} channel - Channel to send/update in
 * @param {import('kazagumo').KazagumoPlayer} player
 * @param {object} settings - Guild settings (largeArt, etc.)
 */
async function refreshControlPanel(client, channel, player, settings) {
  if (!channel?.isTextBased()) return;

  const { buildNowPlayingV2, buildIdleV2, extractDominantColor } = require('./componentBuilder');

  const track = player.queue.current;
  const artUrl = track ? (track.artworkUrl || track.thumbnail || null) : null;
  const accentColor =
    player.data.get('accentColor') ||
    (await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff)));
  player.data.set('accentColor', accentColor);

  const payload = track
    ? buildNowPlayingV2(track, player, settings.largeArt)
    : buildIdleV2(null, settings.largeArt);

  // Try to edit the existing control panel in-place if it's in the same channel
  const oldControlId = player.data.get('controlMessageId');
  const oldControlChannelId = player.data.get('controlMessageChannelId');
  if (oldControlId && oldControlChannelId === channel.id) {
    try {
      const oldChannel = client.channels.cache.get(oldControlChannelId);
      if (oldChannel?.isTextBased()) {
        const oldMsg = await oldChannel.messages.fetch(oldControlId).catch(() => null);
        if (oldMsg?.editable) {
          await oldMsg.edit(payload);
          return;
        }
      }
    } catch {
      // Fall through to delete + resend
    }
  }

  // Delete old control panel (different channel or no longer editable)
  if (oldControlId && oldControlChannelId) {
    try {
      const oldChannel = client.channels.cache.get(oldControlChannelId);
      if (oldChannel?.isTextBased()) {
        oldChannel.messages.fetch(oldControlId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }

  // Send a fresh control panel
  try {
    const msg = await channel.send(payload);
    // Track both as control panel AND as the now-playing message so that:
    // - playerStart can update it when the next track starts (uses controlMessageId)
    // - updateNowPlayingMessage / panelUpdater bury-count logic can find & edit it (uses nowPlayingMessageId)
    player.data.set('controlMessageId', msg.id);
    player.data.set('controlMessageChannelId', channel.id);
    player.data.set('nowPlayingMessage', msg);
    player.data.set('nowPlayingMessageId', msg.id);
    player.data.set('nowPlayingMessageChannelId', channel.id);
    player.data.set('npBuryCount', 0);
  } catch (err) {
    console.error('[panelUpdater] Failed to send control panel:', err);
  }
}

module.exports = { updateNowPlayingMessage, incrementBuryCount, refreshControlPanel };
