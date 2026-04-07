const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed, buildNowPlayingEmbed } = require('../../../utils/embeds');
const { buildPlayerButtons } = require('../../../utils/functions');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.'),

  async run(client, interaction) {
    await interaction.deferReply();

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const embed = buildNowPlayingEmbed(player.queue.current, player);
    const row = buildPlayerButtons(player);

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};
