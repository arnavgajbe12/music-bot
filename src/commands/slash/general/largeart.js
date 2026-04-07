const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('largeart')
    .setDescription('Toggle whether album art is shown as a large banner or small thumbnail.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('on = large banner, off = small thumbnail')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const mode = interaction.options.getString('mode');
    const largeArt = mode === 'on';

    updateSettings(interaction.guild.id, { largeArt });

    return interaction.editReply({
      embeds: [
        buildEmbed(
          largeArt
            ? '🖼️ Large Art is now **ON** — album art will be shown as a large banner.'
            : '🖼️ Large Art is now **OFF** — album art will be shown as a small thumbnail.',
        ),
      ],
    });
  },
};
