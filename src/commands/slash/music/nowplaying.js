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

    const settings = getSettings(interaction.guild.id);
    const payload = buildNowPlayingV2NoButtons(player.queue.current, player, settings.largeArt);

    const msg = await interaction.editReply(payload);

    // Store the message reference on the player so playerEnd/playerStart can delete it
    const existingMsgs = player.data.get('nowPlayingCmdMessages') || [];
    existingMsgs.push(msg);
    player.data.set('nowPlayingCmdMessages', existingMsgs);
  },
};
