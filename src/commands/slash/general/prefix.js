const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { setPrefixes } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Set the server command prefix (Admin only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('new_prefix').setDescription('The new prefix (max 5 chars)').setRequired(true),
    ),

  async run(client, interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [buildErrorEmbed('You need Administrator permission to change the prefix.')], ephemeral: true });
    }

    const newPrefix = interaction.options.getString('new_prefix');
    if (newPrefix.length > 5) {
      return interaction.reply({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')], ephemeral: true });
    }

    setPrefixes(interaction.guild.id, [newPrefix]);
    return interaction.reply({ embeds: [buildEmbed(`✅ Server prefix changed to \`${newPrefix}\`.`)], ephemeral: true });
  },
};
