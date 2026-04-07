const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nodes')
    .setDescription('Show statistics for all connected Lavalink nodes.'),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const shoukaku = client.manager.shoukaku;
    const nodes = [...shoukaku.nodes.values()];

    if (!nodes.length) {
      const embed = new EmbedBuilder()
        .setColor(config.embeds.errorColor)
        .setDescription('❌ No Lavalink nodes are configured.');
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(config.embeds.color)
      .setAuthor({ name: '🎛️ Lavalink Node Statistics' })
      .setTimestamp()
      .setFooter({ text: config.embeds.footerText });

    for (const node of nodes) {
      const state = node.state === 2 ? '🟢 Connected' : node.state === 1 ? '🟡 Connecting' : '🔴 Disconnected';
      const stats = node.stats;
      const players = stats?.players ?? 0;
      const playingPlayers = stats?.playingPlayers ?? 0;
      const uptime = stats?.uptime
        ? (() => {
            const s = Math.floor(stats.uptime / 1000);
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            return `${h}h ${m}m`;
          })()
        : 'N/A';
      const mem = stats?.memory;
      const memUsed = mem ? `${Math.round(mem.used / 1024 / 1024)} MB` : 'N/A';
      const cpu = stats?.cpu;
      const cpuLoad = cpu ? `${(cpu.lavalinkLoad * 100).toFixed(1)}%` : 'N/A';

      embed.addFields({
        name: `📡 ${node.name}`,
        value: [
          `**Status:** ${state}`,
          `**Players:** ${playingPlayers} playing / ${players} total`,
          `**Uptime:** ${uptime}`,
          `**Memory:** ${memUsed}`,
          `**CPU:** ${cpuLoad}`,
        ].join('\n'),
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
