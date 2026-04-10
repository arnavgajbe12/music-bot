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

    // Mark as intentional so voiceStateUpdate doesn't double-destroy
    player.data.set('intentionalDisconnect', true);
    player.queue.clear();
    try {
      // Explicitly release Shoukaku's WebRTC session before Kazagumo destroy
      // to prevent ghost sessions on the Lavalink node.
      const shoukakuPlayer = player.shoukaku;
      if (shoukakuPlayer) {
        await shoukakuPlayer.node.destroyPlayer(interaction.guild.id).catch(() => {});
        await client.manager.shoukaku.leaveVoiceChannel(interaction.guild.id).catch(() => {});
      }
      await player.destroy();
    } catch {
      // Best-effort cleanup
    }

    const payload = buildConfirmV2(`👋 Left **${channelName}** and cleared the queue.`, 0xed4245);
    return interaction.editReply(payload);
  },
};

