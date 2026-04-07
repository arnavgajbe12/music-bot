const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set or check the player volume.')
    .addIntegerOption((option) =>
      option.setName('level').setDescription('Volume level (1-200)').setMinValue(1).setMaxValue(200),
    ),

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

    const vol = interaction.options.getInteger('level');
    if (!vol) {
      return interaction.editReply({
        embeds: [buildEmbed(`${config.emojis.volumeUp} Current volume: **${player.volume}%**`)],
      });
    }

    const prevVol = player.volume;
    await player.setVolume(vol);

    return interaction.editReply({
      embeds: [buildEmbed(`${vol > prevVol ? config.emojis.volumeUp : config.emojis.volumeDown} Volume set to **${vol}%**.`)],
    });
  },
};
