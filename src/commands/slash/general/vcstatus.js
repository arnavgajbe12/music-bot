const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcstatus')
    .setDescription('Set or clear the voice channel status.')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('Status text (leave blank to clear)')
        .setRequired(false),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const player = client.manager.players.get(interaction.guild.id);
    const voiceChannelId = player?.voiceId ?? interaction.member.voice?.channel?.id;

    if (!voiceChannelId) {
      return interaction.editReply({
        embeds: [buildErrorEmbed('No active voice channel found. Join a voice channel or start playing music first.')],
      });
    }

    const statusText = interaction.options.getString('text') || '';

    try {
      await client.rest.put(`/channels/${voiceChannelId}/voice-status`, {
        body: { status: statusText },
      });

      const message = statusText
        ? `🎙️ Voice channel status set to: **${statusText}**`
        : '🎙️ Voice channel status has been cleared.';

      return interaction.editReply({ embeds: [buildEmbed(message)] });
    } catch (error) {
      console.error('[vcstatus]', error);
      return interaction.editReply({
        embeds: [buildErrorEmbed('Failed to update the voice channel status. Make sure the bot has the **Manage Channels** permission in the voice channel.')],
      });
    }
  },
};
