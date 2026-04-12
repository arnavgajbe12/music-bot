const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { buildSetupIdleV2 } = require('../../../utils/componentBuilder');
const { saveSetup, removeSetup, getSetup } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the dedicated Song Request channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the song request channel.')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('The channel to use as the song request panel').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove the song request channel setup.'),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'remove') {
      removeSetup(interaction.guild.id);
      return interaction.editReply({
        embeds: [buildEmbed('🗑️ Song Request channel has been removed.')],
      });
    }

    // sub === 'channel'
    const channel = interaction.options.getChannel('channel');
    if (!channel?.isTextBased()) {
      return interaction.editReply({
        embeds: [buildErrorEmbed('Please select a valid text channel.')],
      });
    }

    // Block setting a new setup channel if one is already configured
    const existingSetup = getSetup(interaction.guild.id);
    if (existingSetup) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(`A Song Request channel is already configured (<#${existingSetup.channelId}>). Please run \`/setup remove\` first.`)],
      });
    }

    const payload = buildSetupIdleV2();

    let panelMsg;
    try {
      panelMsg = await channel.send(payload);
    } catch (error) {
      console.error('[setup] Failed to send panel:', error);
      return interaction.editReply({
        embeds: [buildErrorEmbed(`Failed to send the panel to ${channel}. Make sure I have permission to send messages there.`)],
      });
    }

    saveSetup(interaction.guild.id, channel.id, panelMsg.id);

    return interaction.editReply({
      embeds: [
        buildEmbed(
          `✅ Song Request channel set to ${channel}.\n\nUsers can now type a song name (or use \`yt\`, \`sp\`, \`ap\`, etc. as a prefix) directly in that channel to request songs!`,
        ),
      ],
    });
  },
};
