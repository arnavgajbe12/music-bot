const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all upcoming tracks from the queue.'),

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

    const count = player.queue.size;
    if (count === 0) {
      return interaction.editReply({ embeds: [buildErrorEmbed('The queue is already empty.')] });
    }

    player.queue.clear();

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.stop} Cleared **${count}** track(s) from the queue.`)],
    });
  },
};
