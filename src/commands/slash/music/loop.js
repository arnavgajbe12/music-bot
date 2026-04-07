const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle loop mode for the current track or the entire queue.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode')
        .setRequired(false)
        .addChoices(
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' },
          { name: 'Off', value: 'none' },
        ),
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

    const mode = interaction.options.getString('mode');
    let newMode;

    if (mode) {
      newMode = mode;
    } else {
      // Cycle: none → track → queue → none
      const current = player.loop || 'none';
      if (current === 'none') newMode = 'track';
      else if (current === 'track') newMode = 'queue';
      else newMode = 'none';
    }

    player.setLoop(newMode);

    const modeLabels = {
      none: `${config.emojis.stop} Off`,
      track: `${config.emojis.loop} Track`,
      queue: `${config.emojis.loop} Queue`,
    };

    return interaction.editReply({
      embeds: [buildEmbed(`Loop mode set to **${modeLabels[newMode] || newMode}**.`)],
    });
  },
};
