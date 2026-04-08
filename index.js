require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const { KazagumoSpotify } = require('kazagumo-spotify');
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
    url: `${(process.env.LAVA_HOST || 'localhost').replace(/^https?:\/\/|^wss?:\/\//i, '')}:${process.env.LAVA_PORT || '2333'}`,
    auth: process.env.LAVA_PASS,
    secure: process.env.LAVA_SECURE === 'true',
  },
];

// ─── Kazagumo (Music Manager) ───────────────────────────────────────────────────
client.manager = new Kazagumo(
  {
    defaultSearchengine: config.player.defaultSearchPlatform,
    plugins: [
      new KazagumoSpotify({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        playlistPageLimit: 1,
        albumPageLimit: 1,
        searchLimit: 10,
      }),
    ],
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
