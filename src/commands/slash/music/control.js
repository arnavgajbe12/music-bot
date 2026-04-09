const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const {
  buildNowPlayingV2,
  buildIdleV2,
  extractDominantColor,
} = require('../../../utils/componentBuilder');
const { getSettings } = require('../../../utils/setupManager');

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
    const settings = getSettings(interaction.guild.id);

    if (track) {
      const artUrl = track.thumbnail || track.artworkUrl || null;
      const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
      player.data.set('accentColor', accentColor);
      payload = buildNowPlayingV2(track, player, settings.largeArt);
    } else {
      payload = buildIdleV2(null, settings.largeArt);
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
