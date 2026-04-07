const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a specific track from the queue by its position.')
    .addIntegerOption((option) =>
      option
        .setName('position')
        .setDescription('Position of the track in the queue (1 = next track)')
        .setMinValue(1)
        .setRequired(true),
    ),

  async run(client, interaction) {
    await interaction.deferReply();

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(interaction.member, interaction.guild, player);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const tracks = player.queue.tracks ?? [];
    const position = interaction.options.getInteger('position');

    if (position > tracks.length) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(`Position **${position}** is out of range. The queue has **${tracks.length}** track(s).`)],
      });
    }

    const removed = tracks.splice(position - 1, 1)[0];

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.stop} Removed **[${removed.title}](${removed.uri})** from position **${position}**.`)],
    });
  },
};
