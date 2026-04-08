const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildConfirmV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel.'),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const voiceChannel = interaction.member.voice.channel;

    let player = client.manager.players.get(interaction.guild.id);

    // If a player exists but bot was manually kicked from VC, destroy the stale player
    const botVoiceChannelId = interaction.guild.members.me?.voice?.channelId;
    if (player && !botVoiceChannelId) {
      await player.destroy().catch(() => {});
      player = null;
    }

    if (player && player.voiceId === voiceChannel.id) {
      return interaction.editReply({ embeds: [buildErrorEmbed(`I'm already in **${voiceChannel.name}**!`)] });
    }

    if (!player) {
      player = await client.manager.createPlayer({
        guildId: interaction.guild.id,
        voiceId: voiceChannel.id,
        textId: interaction.channel.id,
        deaf: true,
        shardId: interaction.guild.shardId ?? 0,
      });
      player.data.set('textChannel', interaction.channel.id);
    }

    const payload = buildConfirmV2(`✅ Joined **${voiceChannel.name}**!`, 0x57f287);
    return interaction.editReply(payload);
  },
};
