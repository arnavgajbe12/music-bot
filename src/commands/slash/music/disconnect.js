const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildConfirmV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Destroy the player and forcefully disconnect the bot from the Voice Channel.'),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      return interaction.editReply({ embeds: [buildErrorEmbed('I am not in a voice channel right now.')] });
    }

    const voiceCheck = checkVoice(interaction.member, interaction.guild, player);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const channelName = interaction.guild.channels.cache.get(player.voiceId)?.name || 'voice channel';

    // Clear queue and destroy player
    player.data.set('intentionalDisconnect', true);
    player.queue.clear();
    try {
      await player.destroy();
    } catch {
      // Ignore
    }

    // Force the bot to leave the VC via the voice adapter if still connected
    try {
      const botVoice = interaction.guild.members.me?.voice;
      if (botVoice?.channel) {
        await botVoice.disconnect();
      }
    } catch {
      // Non-fatal
    }

    const payload = buildConfirmV2(`👋 Left **${channelName}** and cleared the queue.`, 0xed4245);
    return interaction.editReply(payload);
  },
};

