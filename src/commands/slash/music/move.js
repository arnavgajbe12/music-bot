const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a song from one queue position to another.')
    .addIntegerOption((opt) =>
      opt.setName('from').setDescription('Current position of the song in the queue').setRequired(true).setMinValue(1),
    )
    .addIntegerOption((opt) =>
      opt.setName('to').setDescription('New position to move the song to').setRequired(true).setMinValue(1),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    const voiceCheck = checkVoice(interaction.member, interaction.guild, player);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const from = interaction.options.getInteger('from');
    const to = interaction.options.getInteger('to');

    const tracks = [...player.queue];

    if (from > tracks.length || to > tracks.length) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(`Queue only has **${tracks.length}** track(s). Both positions must be within range.`)],
      });
    }

    if (from === to) {
      return interaction.editReply({ embeds: [buildErrorEmbed('Source and destination positions are the same.')] });
    }

    const [movedTrack] = tracks.splice(from - 1, 1);
    tracks.splice(to - 1, 0, movedTrack);

    player.queue.splice(0, player.queue.length, ...tracks);

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.queue} Moved **${movedTrack.title}** from position #${from} to #${to}.`)],
    });
  },
};
