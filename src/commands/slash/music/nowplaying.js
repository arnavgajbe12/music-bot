const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildNowPlayingV2NoButtons } = require('../../../utils/componentBuilder');
const { getSettings } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track.'),

  async run(client, interaction) {
    await interaction.deferReply();

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

    const settings = getSettings(interaction.guild.id);
    const payload = buildNowPlayingV2NoButtons(player.queue.current, player, settings.largeArt);

    const msg = await interaction.editReply(payload);
    player.data.set('npCmdMessage', msg);
  },
};

