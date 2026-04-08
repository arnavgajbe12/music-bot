const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const {
  buildSetupNowPlayingV2,
  buildSetupQueueViewV2,
  buildSetupIdleV2,
  extractDominantColor,
} = require('../../../utils/componentBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('control')
    .setDescription('Send a portable music control panel that stays updated.'),

  async run(client, interaction) {
    const player = client.manager.players.get(interaction.guild.id);

    if (!player) {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({ embeds: [buildErrorEmbed('There is no active player. Start playing a song first.')] });
    }

    // Defer publicly so we can send the panel into the channel
    await interaction.deferReply({ ephemeral: false });

    let payload;
    const track = player.queue.current;

    if (track) {
      const artUrl = track.thumbnail || track.artworkUrl || null;
      const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
      player.data.set('accentColor', accentColor);

      const isQueueView = player.data.get('setupQueueView') === true;
      if (isQueueView) {
        const tracks = [...player.queue];
        const qPage = player.data.get('setupQueuePage') || 1;
        payload = buildSetupQueueViewV2(track, tracks, qPage, accentColor, player);
      } else {
        payload = buildSetupNowPlayingV2(track, player, accentColor);
      }
    } else {
      payload = buildSetupIdleV2();
    }

    // Delete the old control message if one exists
    const oldControlId = player.data.get('controlMessageId');
    const oldControlChannelId = player.data.get('controlMessageChannelId');
    if (oldControlId && oldControlChannelId) {
      const oldChannel = client.channels.cache.get(oldControlChannelId);
      if (oldChannel?.isTextBased()) {
        oldChannel.messages.fetch(oldControlId)
          .then((m) => m.delete().catch(() => {}))
          .catch(() => {});
      }
    }

    // Edit the deferred reply to show the panel — this creates the message we track
    const msg = await interaction.editReply(payload);
    player.data.set('controlMessageId', msg.id);
    player.data.set('controlMessageChannelId', interaction.channel.id);
  },
};
