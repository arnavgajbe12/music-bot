const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const { getSettings, updateSettings } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay — automatically fetch related tracks when the queue ends.'),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const settings = getSettings(interaction.guild.id);
    const newVal = !settings.autoplay;
    updateSettings(interaction.guild.id, { autoplay: newVal });

    // If a player exists, apply the setting immediately
    const player = client.manager.players.get(interaction.guild.id);
    if (player && typeof player.setAutoplay === 'function') {
      player.setAutoplay(newVal);
    } else if (player && player.data) {
      player.data.set('autoplay', newVal);
    }

    return interaction.editReply({
      embeds: [
        buildEmbed(
          newVal
            ? '🔄 Autoplay is now **ON** — related tracks will play when the queue ends.'
            : '🔄 Autoplay is now **OFF**.',
        ),
      ],
    });
  },
};
