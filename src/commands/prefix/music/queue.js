const { EmbedBuilder } = require('discord.js');
const { buildErrorEmbed, formatDuration } = require('../../../utils/embeds');
const config = require('../../../../config');

module.exports = {
  name: 'queue',
  aliases: ['q'],
  description: 'Show the current music queue.',
  usage: '[page]',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const tracks = player.queue.tracks ?? [];
    const current = player.queue.current;
    const tracksPerPage = 10;
    const page = Math.max(1, parseInt(args[0]) || 1);
    const totalPages = Math.max(1, Math.ceil(tracks.length / tracksPerPage));
    const clampedPage = Math.min(page, totalPages);
    const start = (clampedPage - 1) * tracksPerPage;
    const end = start + tracksPerPage;

    const queueList = tracks
      .slice(start, end)
      .map((track, i) => `**${start + i + 1}.** [${track.title}](${track.uri}) — \`${formatDuration(track.length)}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.embeds.color)
      .setTitle(`${config.emojis.queue} Music Queue`)
      .setDescription(
        `**Now Playing:**\n[${current.title}](${current.uri}) — \`${formatDuration(current.length)}\`\n\n` +
          (queueList || '*No upcoming tracks.*'),
      )
      .setFooter({ text: `Page ${clampedPage}/${totalPages} • ${tracks.length} track(s) in queue • ${config.embeds.footerText}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
