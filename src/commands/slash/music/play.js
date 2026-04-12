const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed, formatDuration } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice, searchWithFallback } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');
const { logToWebhook } = require('../../../utils/webhookLogger');
const { refreshControlPanel } = require('../../../utils/panelUpdater');
const { METADATA_SOURCE_TO_PREFIX } = require('../../../utils/constants');

// Allowed search-prefix values to prevent injection of arbitrary Lavalink prefixes
const ALLOWED_SOURCES = new Set(['ytmsearch', 'ytsearch', 'scsearch', 'spsearch', 'jssearch', 'amsearch', 'dzsearch']);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name, URL, or Spotify link')
        .setRequired(true)
        .setAutocomplete(true),
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

  async autocomplete(client, interaction) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue || focusedValue.trim().length < 2) {
      return interaction.respond([]).catch(() => {});
    }
    try {
      const settings = getSettings(interaction.guild.id);
      const searchPrefix = METADATA_SOURCE_TO_PREFIX[settings.metadataSource] || 'ytmsearch:';
      const query = `${searchPrefix}${focusedValue.trim()}`;
      const result = await client.manager.search(query, { requester: interaction.user, source: '' });
      if (!result || !result.tracks.length) return interaction.respond([]).catch(() => {});
      const choices = result.tracks.slice(0, 10).map((t) => {
        const duration = formatDuration(t.length);
        const title = t.title || 'Unknown';
        const artist = t.author || 'Unknown';
        const labelRaw = `${title} - ${artist} - ${duration}`;
        const label = labelRaw.length > 100 ? labelRaw.slice(0, 97) + '...' : labelRaw;
        const value = (t.uri || `${title} ${artist}`).slice(0, 100);
        return { name: label, value };
      });
      return interaction.respond(choices).catch(() => {});
    } catch {
      return interaction.respond([]).catch(() => {});
    }
  },

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: false });

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
      try { await player.shoukaku?.node?.destroyPlayer(interaction.guild.id); } catch {}
      try { await client.manager.shoukaku?.leaveVoiceChannel(interaction.guild.id); } catch {}
      try { await player.destroy(); } catch {}
      client.manager.players.delete(interaction.guild.id);
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
      const prevChannelId = player.data.get('textChannel');
      const channelChanged = prevChannelId && prevChannelId !== interaction.channel.id;
      // Update text channel if the user is issuing the command from a different channel
      player.data.set('textChannel', interaction.channel.id);
      // Clear old now-playing message reference so a new one is sent
      player.data.delete('nowPlayingMessage');
      player.data.delete('nowPlayingMessageId');
      player.data.delete('nowPlayingMessageChannelId');
      // Move the control panel to the new channel when user switches channels
      if (channelChanged) {
        player.data.delete('controlMessageId');
        player.data.delete('controlMessageChannelId');
      }
    }

    // Use source option (if provided) → per-guild metadataSource → playbackSource → fallback chain
    const settings = getSettings(interaction.guild.id);
    const sourceOption = interaction.options.getString('source');
    // Build the search prefix: colon is appended to the option value (e.g. 'ytmsearch' → 'ytmsearch:')
    const selectedPrefix = sourceOption && ALLOWED_SOURCES.has(sourceOption) ? `${sourceOption}:` : null;
    const effectivePrefix = selectedPrefix
      || METADATA_SOURCE_TO_PREFIX[settings.metadataSource]
      || settings.playbackSource
      || null;

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
        // Send/update the control panel so users can interact immediately
        refreshControlPanel(client, interaction.channel, player, settings).catch(() => {});
        return;
      }
      await interaction.deleteReply().catch(() => {});
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!wasIdle) {
        // Song added to an already-running queue – show "Added to Queue" Component v2 (non-ephemeral)
        const queueSize = player.queue.length;
        const payload = buildAddedToQueueV2(track, queueSize);
        await interaction.editReply(payload);
        // Send/update the control panel so users can interact immediately
        refreshControlPanel(client, interaction.channel, player, settings).catch(() => {});
        return;
      }
      // Starting fresh – delete the deferred reply and let playerStart handle the Now Playing panel
      await interaction.deleteReply().catch(() => {});
    }

    if (wasIdle) await player.play();
  },
};
