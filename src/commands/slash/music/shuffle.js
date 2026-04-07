const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the upcoming tracks in the queue.'),

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
    if (tracks.length < 2) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There are not enough tracks in the queue to shuffle.')] });
    }

    // Fisher-Yates shuffle
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.shuffle} Shuffled **${tracks.length}** tracks in the queue.`)],
    });
  },
};
