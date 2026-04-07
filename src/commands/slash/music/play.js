const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name, URL, or Spotify link').setRequired(true),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const rawQuery = interaction.options.getString('query');
    // Use the guild's stored playback source, or fall back to YouTube Music
    const settings = getSettings(interaction.guild.id);
    const searchPrefix = settings.playbackSource || 'ytmsearch:';
    const isUrl = /^https?:\/\//i.test(rawQuery);
    const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;
    const voiceChannel = interaction.member.voice.channel;

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = await client.manager.createPlayer({
        guildId: interaction.guild.id,
        voiceId: voiceChannel.id,
        textId: interaction.channel.id,
        deaf: true,
        shardId: interaction.guild.shardId ?? 0,
      });
      player.data.set('textChannel', interaction.channel.id);
    } else {
      // Update text channel if the user is issuing the command from a different channel
      const prevChannelId = player.data.get('textChannel');
      if (prevChannelId && prevChannelId !== interaction.channel.id) {
        player.data.set('textChannel', interaction.channel.id);
        // Delete the old now-playing message so the new one appears in this channel
        const oldMsgId = player.data.get('nowPlayingMessageId');
        const oldChannelId = player.data.get('nowPlayingMessageChannelId');
        if (oldMsgId && oldChannelId) {
          const oldChannel = client.channels.cache.get(oldChannelId);
          if (oldChannel?.isTextBased()) {
            oldChannel.messages.fetch(oldMsgId).then((m) => m.delete().catch(() => {})).catch(() => {});
          }
          player.data.delete('nowPlayingMessage');
          player.data.delete('nowPlayingMessageId');
          player.data.delete('nowPlayingMessageChannelId');
        }
      }
    }

    let result;
    try {
      result = await client.manager.search(query, { requester: interaction.user });
    } catch {
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
    }

    if (!result || !result.tracks.length) {
      return interaction.editReply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    const wasIdle = !player.playing && !player.paused;

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) player.queue.add(track);
      // If it wasn't already playing, the playerStart event will show the Now Playing panel.
      // Only show "Added to Queue" if songs were added to an already-running queue.
      if (!wasIdle) {
        const artUrl = result.tracks[0]?.thumbnail || result.tracks[0]?.artworkUrl;
        const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
        await interaction.editReply(payload);
        setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
        return;
      }
      await interaction.deleteReply().catch(() => {});
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!wasIdle) {
        // Song added to an already-running queue – show "Added to Queue" Component v2
        const queueSize = player.queue.size;
        const payload = buildAddedToQueueV2(track, queueSize);
        await interaction.editReply(payload);
        setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
        return;
      }
      // Starting fresh – the playerStart event will send the Now Playing panel
      await interaction.deleteReply().catch(() => {});
    }

    if (wasIdle) await player.play();
  },
};
