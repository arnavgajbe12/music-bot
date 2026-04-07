const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode — the bot stays in the voice channel even when the queue ends.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const settings = getSettings(interaction.guild.id);
    const newVal = !settings.mode247;
    updateSettings(interaction.guild.id, { mode247: newVal });

    return interaction.editReply({
      embeds: [
        buildEmbed(
          newVal
            ? '🔁 **24/7 mode is now ON** — I will stay in the voice channel indefinitely.'
            : '🔁 **24/7 mode is now OFF** — I will leave when the queue ends.',
        ),
      ],
    });
  },
};
