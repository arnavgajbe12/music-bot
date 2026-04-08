const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildNowPlayingEmbed } = require('../../../utils/componentBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.'),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: false });

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    // Delete the previous /nowplaying message if one exists (no duplicates)
    const oldNpMsg = player.data.get('npCmdMessage');
    if (oldNpMsg) {
      oldNpMsg.delete().catch(() => {});
      player.data.delete('npCmdMessage');
    }

    const payload = buildNowPlayingEmbed(player.queue.current, player);

    const msg = await interaction.editReply(payload);
    player.data.set('npCmdMessage', msg);
  },
};

