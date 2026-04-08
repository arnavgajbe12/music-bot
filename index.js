require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const config = require('./config');

// ─── Client Setup ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

// ─── Command Collections ────────────────────────────────────────────────────────
client.commands = new Collection();
client.slashCommands = new Collection();

// ─── Lavalink Nodes ─────────────────────────────────────────────────────────────
const nodes = [
  {
    name: 'Main',
    url: `${(process.env.LAVA_HOST || 'localhost').replace(/^https?:\/\/|^wss?:\/\//i, '')}:${process.env.LAVA_PORT || 2333}`,
    auth: process.env.LAVA_PASS,
    secure: process.env.LAVA_SECURE === 'true',
  },
];

// ─── Kazagumo (Music Manager) ───────────────────────────────────────────────────
client.manager = new Kazagumo(
  {
    // Kazagumo's defaultSearchEngine only accepts 'youtube' | 'youtube_music' | 'soundcloud'.
    // config.player.defaultSearchPlatform holds 'ytmsearch' which Kazagumo silently ignores,
    // so we hard-code 'youtube_music' here to get the desired ytmsearch: default.
    defaultSearchEngine: 'youtube_music',
    plugins: [],
  },
  new Connectors.DiscordJS(client),
  nodes,
  {
    moveOnDisconnect: false,
    resume: false,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 60,
  }
);

// ─── Load Handlers ───────────────────────────────────────────────────────────────
require('./src/handlers/commandHandler')(client);
require('./src/handlers/eventHandler')(client);
require('./src/handlers/interactionHandler')(client);

// ─── Global Error Handling ──────────────────────────────────────────────────────
const { WebhookClient } = require('discord.js');

process.on('unhandledRejection', async (error) => {
  console.error('[UnhandledRejection]', error);
  if (process.env.ERROR_WEBHOOK_URL) {
    try {
      const webhook = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });
      await webhook.send({
        content: `**[UnhandledRejection]**\n\`\`\`js\n${String(error).slice(0, 1900)}\n\`\`\``,
      });
    } catch (_) {}
  }
});

process.on('uncaughtException', async (error) => {
  console.error('[UncaughtException]', error);
  if (process.env.ERROR_WEBHOOK_URL) {
    try {
      const webhook = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });
      await webhook.send({
        content: `**[UncaughtException]**\n\`\`\`js\n${String(error).slice(0, 1900)}\n\`\`\``,
      });
    } catch (_) {}
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
