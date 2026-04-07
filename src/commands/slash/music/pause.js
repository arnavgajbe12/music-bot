const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause or resume the current track.'),

  async run(client, interaction) {
    await interaction.deferReply();

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || (!player.playing && !player.paused)) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(interaction.member, interaction.guild, player);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    await player.pause(!player.paused);
    const state = player.paused ? 'paused' : 'resumed';
    const emoji = player.paused ? config.emojis.pause : config.emojis.play;

    return interaction.editReply({
      embeds: [buildEmbed(`${emoji} The player has been **${state}**.`)],
    });
  },
};
