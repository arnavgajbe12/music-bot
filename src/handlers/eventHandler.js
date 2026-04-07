const fs = require('fs');
const path = require('path');

/**
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  // ── Discord client events ──────────────────────────────────────────────────
  const clientEventsDir = path.join(__dirname, '..', 'events', 'client');
  const clientFiles = fs.readdirSync(clientEventsDir).filter((f) => f.endsWith('.js'));

  for (const file of clientFiles) {
    const event = require(path.join(clientEventsDir, file));
    const eventName = file.replace('.js', '');
    if (event.once) {
      client.once(eventName, (...args) => event.run(client, ...args));
    } else {
      client.on(eventName, (...args) => event.run(client, ...args));
    }
    console.log(`[Events] Registered client event: ${eventName}`);
  }

  // ── Kazagumo player events ─────────────────────────────────────────────────
  const playerEventsDir = path.join(__dirname, '..', 'events', 'player');
  const playerFiles = fs.readdirSync(playerEventsDir).filter((f) => f.endsWith('.js'));

  for (const file of playerFiles) {
    const event = require(path.join(playerEventsDir, file));
    const eventName = file.replace('.js', '');
    client.manager.on(eventName, (...args) => event.run(client, ...args));
    console.log(`[Events] Registered player event: ${eventName}`);
  }

  // ── Shoukaku node events ───────────────────────────────────────────────────
  // These fire after the manager is connected, so we listen on 'ready'
  client.once('ready', () => {
    const shoukaku = client.manager.shoukaku;

    shoukaku.on('ready', (name) => {
      console.log(`[Shoukaku] Node "${name}" is ready.`);
      logToChannel(client, `${require('../../config').emojis.success} Lavalink node **${name}** is now **connected**.`);
    });

    shoukaku.on('error', (name, error) => {
      console.error(`[Shoukaku] Node "${name}" encountered an error:`, error);
      logToChannel(client, `${require('../../config').emojis.error} Lavalink node **${name}** encountered an error: \`${error.message}\``);
    });

    shoukaku.on('close', (name, code, reason) => {
      console.warn(`[Shoukaku] Node "${name}" closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
      logToChannel(client, `⚠️ Lavalink node **${name}** disconnected. Code: \`${code}\``);
    });

    shoukaku.on('reconnecting', (name) => {
      console.log(`[Shoukaku] Node "${name}" is reconnecting...`);
      logToChannel(client, `🔄 Lavalink node **${name}** is reconnecting...`);
    });
  });
};

/**
 * Send a message to the configured Lavalink log channel
 * @param {import('discord.js').Client} client
 * @param {string} message
 */
function logToChannel(client, message) {
  const config = require('../../config');
  const channelId = config.logs.lavalinkLogChannel;
  if (!channelId || channelId === 'YOUR_LAVALINK_LOG_CHANNEL_ID') return;
  const channel = client.channels.cache.get(channelId);
  if (channel?.isTextBased()) {
    channel.send(message).catch(() => {});
  }
}
