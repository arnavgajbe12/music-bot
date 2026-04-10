/**
 * !stats
 * Sends a ComponentV2 panel with bot statistics in a dropdown format.
 * Shows: Bot Info, Node Info, Lavalink Info, Ping Info.
 * Prefix-only command (no slash equivalent).
 */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../../../../config');
const { formatDuration } = require('../../../utils/embeds');

/**
 * Format bytes into a human-readable string (KB / MB / GB).
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

/**
 * Format uptime in ms into "Xd Xh Xm Xs".
 * @param {number} ms
 * @returns {string}
 */
function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

/**
 * Build the full stats ComponentV2 container for a given category.
 * @param {import('discord.js').Client} client
 * @param {string} category - 'botinfo' | 'nodesinfo' | 'lavalinkinfo' | 'pinginfo'
 * @param {string} [selectedValue] - The currently selected dropdown value
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildStatsPayload(client, category = 'botinfo', selectedValue) {
  const container = new ContainerBuilder();
  container.setAccentColor(config.embeds.color);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 📊 Bot Statistics`),
  );
  container.addSeparatorComponents(new SeparatorBuilder());

  // ── Category content ────────────────────────────────────────────────────────
  if (category === 'botinfo') {
    const mem = process.memoryUsage();
    const botUser = client.user;
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);
    const channelCount = client.channels.cache.size;
    const ping = client.ws.ping;
    const uptime = formatUptime(client.uptime || 0);

    const lines = [
      `**🤖 Bot:** ${botUser?.tag || 'Unknown'}`,
      `**🆔 ID:** \`${botUser?.id || 'N/A'}\``,
      `**🌐 Guilds:** ${guildCount}`,
      `**👥 Users:** ${userCount.toLocaleString()}`,
      `**💬 Channels:** ${channelCount}`,
      `**⏱️ Uptime:** ${uptime}`,
      `**🏓 WS Ping:** ${ping}ms`,
      `**💾 Heap Used:** ${formatBytes(mem.heapUsed)}`,
      `**💾 RSS:** ${formatBytes(mem.rss)}`,
      `**🟢 Node.js:** ${process.version}`,
      `**📦 Discord.js:** v${require('discord.js').version}`,
    ];

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🤖 Bot Info\n${lines.join('\n')}`),
    );

  } else if (category === 'nodesinfo') {
    const shoukaku = client.manager?.shoukaku;
    const nodes = shoukaku ? [...shoukaku.nodes.values()] : [];

    if (!nodes.length) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### 📡 Nodes Info\n*No nodes configured.*'),
      );
    } else {
      for (const node of nodes) {
        const stateMap = { 0: '🔴 Disconnected', 1: '🟡 Connecting', 2: '🟢 Connected', 3: '🔵 Reconnecting' };
        const stateStr = stateMap[node.state] ?? `❓ State ${node.state}`;
        const s = node.stats;
        const players = s?.players ?? '?';
        const playing = s?.playingPlayers ?? '?';
        const uptime = s?.uptime ? formatUptime(s.uptime) : 'N/A';
        const memUsed = s?.memory?.used != null ? formatBytes(s.memory.used) : 'N/A';
        const memFree = s?.memory?.free != null ? formatBytes(s.memory.free) : 'N/A';
        const cpuLoad = s?.cpu?.lavalinkLoad != null ? `${(s.cpu.lavalinkLoad * 100).toFixed(1)}%` : 'N/A';
        const sysCpu = s?.cpu?.systemLoad != null ? `${(s.cpu.systemLoad * 100).toFixed(1)}%` : 'N/A';

        const lines = [
          `**Status:** ${stateStr}`,
          `**URL:** \`${node.url}\``,
          `**Players:** ${playing} playing / ${players} total`,
          `**Uptime:** ${uptime}`,
          `**Memory:** ${memUsed} used / ${memFree} free`,
          `**CPU (Lavalink):** ${cpuLoad}`,
          `**CPU (System):** ${sysCpu}`,
        ];

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 📡 ${node.name}\n${lines.join('\n')}`),
        );
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    }

  } else if (category === 'lavalinkinfo') {
    const shoukaku = client.manager?.shoukaku;
    const nodes = shoukaku ? [...shoukaku.nodes.values()] : [];
    const totalPlayers = nodes.reduce((acc, n) => acc + (n.stats?.players ?? 0), 0);
    const totalPlaying = nodes.reduce((acc, n) => acc + (n.stats?.playingPlayers ?? 0), 0);
    const guildPlayers = client.manager?.players?.size ?? 0;

    const lines = [
      `**Total Nodes:** ${nodes.length}`,
      `**Online Nodes:** ${nodes.filter((n) => n.state === 2).length}`,
      `**Total Players:** ${totalPlayers}`,
      `**Playing Players:** ${totalPlaying}`,
      `**Bot Active Players:** ${guildPlayers}`,
    ];

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🎛️ Lavalink Overview\n${lines.join('\n')}`),
    );

    // Per-node sources if available
    for (const node of nodes) {
      if (node.info) {
        const sources = node.info.sourceManagers?.join(', ') || 'N/A';
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${node.name} Sources:** ${sources}`),
        );
      }
    }

  } else if (category === 'pinginfo') {
    const wsPing = client.ws.ping;

    const lines = [
      `**🏓 WebSocket Ping:** ${wsPing >= 0 ? `${wsPing}ms` : 'N/A'}`,
      `**🌐 Shards:** ${client.ws.shards?.size ?? 1}`,
      `**⏱️ Uptime:** ${formatUptime(client.uptime || 0)}`,
    ];

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🏓 Ping Info\n${lines.join('\n')}`),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // Dropdown to switch categories
  const menu = new StringSelectMenuBuilder()
    .setCustomId('stats_category')
    .setPlaceholder('Select a category...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🤖 Bot Info')
        .setValue('botinfo')
        .setDescription('General bot statistics')
        .setDefault(category === 'botinfo'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📡 Nodes Info')
        .setValue('nodesinfo')
        .setDescription('All Lavalink node details')
        .setDefault(category === 'nodesinfo'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎛️ Lavalink Info')
        .setValue('lavalinkinfo')
        .setDescription('Lavalink overview & sources')
        .setDefault(category === 'lavalinkinfo'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏓 Ping Info')
        .setValue('pinginfo')
        .setDescription('Latency information')
        .setDefault(category === 'pinginfo'),
    );

  container.addActionRowComponents(new ActionRowBuilder().addComponents(menu));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = {
  name: 'stats',
  aliases: ['botstats', 'info'],
  description: 'Show bot statistics in a dropdown panel.',
  usage: '',

  async run(client, message) {
    const payload = buildStatsPayload(client, 'botinfo');
    await message.channel.send(payload);
    // Don't reply directly to avoid pinging
  },

  buildStatsPayload,
};
