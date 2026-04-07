const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop the music and clear the queue.'),

  async run(client, interaction) {
    await interaction.deferReply();

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is no active player.')] });
    }

    const voiceCheck = checkVoice(interaction.member, interaction.guild, player);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    player.queue.clear();
    await player.destroy();

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.stop} Stopped the music and cleared the queue.`)],
    });
  },
};
