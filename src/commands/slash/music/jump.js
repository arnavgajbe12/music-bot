const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jump')
    .setDescription('Jump to a specific song number in the queue.')
    .addIntegerOption((opt) =>
      opt.setName('position').setDescription('Queue position to jump to (e.g. 3 = 3rd song in queue)').setRequired(true).setMinValue(1),
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

    const num = interaction.options.getInteger('position');
    const tracks = [...player.queue];

    if (num > tracks.length) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(`There are only **${tracks.length}** track(s) in the queue after the current song.`)],
      });
    }

    const target = tracks[num - 1];
    // Move target to front of queue
    player.queue.splice(num - 1, 1);
    player.queue.unshift(target);

    // Skip current song to start the target
    await player.skip();

    return interaction.editReply({
      embeds: [buildEmbed(`${config.emojis.skip} Jumped to **${target.title}** (position #${num}).`)],
    });
  },
};
