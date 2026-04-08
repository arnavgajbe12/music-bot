const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice, searchWithFallback } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');
const { logToWebhook } = require('../../../utils/webhookLogger');

// Map of source option values to Lavalink search prefixes
const SOURCE_PREFIXES = {
  ytmsearch: 'ytmsearch:',
  ytsearch: 'ytsearch:',
  scsearch: 'scsearch:',
  spsearch: 'spsearch:',
  jssearch: 'jssearch:',
  amsearch: 'amsearch:',
  dzsearch: 'dzsearch:',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name, URL, or Spotify link').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('source')
        .setDescription('Platform to search on (optional)')
        .setRequired(false)
        .addChoices(
          { name: '🔴 YouTube Music (default)', value: 'ytmsearch' },
          { name: '▶️ YouTube', value: 'ytsearch' },
          { name: '🟢 Spotify', value: 'spsearch' },
          { name: '🎵 JioSaavn', value: 'jssearch' },
          { name: '🍎 Apple Music', value: 'amsearch' },
          { name: '🎶 Deezer', value: 'dzsearch' },
          { name: '🔶 SoundCloud', value: 'scsearch' },
        ),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const rawQuery = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;

    let player = client.manager.players.get(interaction.guild.id);

    // If a player exists but the bot was manually disconnected from VC, destroy it so we can rejoin
    const botVoiceChannelId = interaction.guild.members.me?.voice?.channelId;
    if (player && !botVoiceChannelId) {
      console.log(`[slash play] Stale player detected in guild "${interaction.guild.id}" — destroying before rejoin.`);
      await player.destroy().catch(() => {});
      player = null;
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

    // Use source option (if provided) → per-guild source → fallback chain
    const settings = getSettings(interaction.guild.id);
    const sourceOption = interaction.options.getString('source');
    const selectedPrefix = sourceOption ? SOURCE_PREFIXES[sourceOption] : null;
    const effectivePrefix = selectedPrefix || settings.playbackSource || null;

    let result;
    try {
      const isUrl = /^https?:\/\//i.test(rawQuery);
      if (effectivePrefix && !isUrl) {
        const query = `${effectivePrefix}${rawQuery}`;
        console.log(`[slash play] Searching with prefix "${effectivePrefix}" → query: "${query}"`);
        result = await client.manager.search(query, { requester: interaction.user, source: '' });
        console.log(`[slash play] Primary search result: type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`);
        if (!result || !result.tracks.length) {
          console.log(`[slash play] Primary source returned no tracks, trying fallback chain...`);
          result = await searchWithFallback(client.manager, rawQuery, interaction.user);
        }
      } else {
        console.log(`[slash play] No source specified, using fallback chain for: "${rawQuery}"`);
        result = await searchWithFallback(client.manager, rawQuery, interaction.user);
      }
    } catch (err) {
      console.error('[slash play] Search threw an exception:', err);
      logToWebhook({
        title: '🚨 /play Search Exception',
        color: 0xed4245,
        fields: [
          { name: 'Guild', value: `${interaction.guild.name} (${interaction.guild.id})`, inline: true },
          { name: 'User', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
          { name: 'Query', value: rawQuery },
          { name: 'Effective Source', value: effectivePrefix || '(none — using fallback)' },
          { name: 'Error', value: (err?.stack || String(err)).slice(0, 1000) },
        ],
      }).catch(() => {});
      try {
        result = await searchWithFallback(client.manager, rawQuery, interaction.user);
      } catch (err2) {
        console.error('[slash play] Fallback search also threw:', err2);
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
      }
    }

    if (!result || !result.tracks.length) {
      console.warn(`[slash play] ❌ No results for query: "${rawQuery}" in guild "${interaction.guild.id}"`);
      logToWebhook({
        title: '❌ /play – No Results',
        color: 0xed4245,
        fields: [
          { name: 'Guild', value: `${interaction.guild.name} (${interaction.guild.id})`, inline: true },
          { name: 'User', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
          { name: 'Query', value: rawQuery },
          { name: 'Effective Source', value: effectivePrefix || '(none — using fallback)' },
          { name: 'Result Type', value: result?.type || 'null/undefined' },
          { name: 'Track Count', value: String(result?.tracks?.length ?? 0) },
        ],
      }).catch(() => {});
      return interaction.editReply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    console.log(`[slash play] ✅ Found result: type=${result.type}, tracks=${result.tracks.length} in guild "${interaction.guild.id}"`);

    const wasIdle = !player.playing && !player.paused;

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) player.queue.add(track);
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
        const queueSize = player.queue.length;
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
