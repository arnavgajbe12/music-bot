const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('./embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('./componentBuilder');
const { checkVoice } = require('./functions');
const { getSettings } = require('./setupManager');
const { refreshControlPanel } = require('./panelUpdater');

/**
 * Build a platform-specific play command.
 * @param {string} name - Slash command name (e.g. 'yt')
 * @param {string} description - Human-readable description
 * @param {string} searchPrefix - Kazagumo/LavaSrc search prefix (e.g. 'ytsearch:')
 * @param {string} platformLabel - Display label (e.g. 'YouTube')
 * @param {object} [opts={}] - Additional options
 * @param {boolean} [opts.useWide=false] - Whether tracks from this command use 16:9 thumbnails
 */
function buildPlatformPlayCommand(name, description, searchPrefix, platformLabel, opts = {}) {
  const useWide = opts.useWide === true;
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addStringOption((opt) =>
        opt.setName('query').setDescription(`Song name to search on ${platformLabel}`).setRequired(true),
      ),

    async run(client, interaction) {
      await interaction.deferReply({ ephemeral: true });

      const voiceCheck = checkVoice(interaction.member, interaction.guild);
      if (!voiceCheck.ok) {
        return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
      }

      const rawQuery = interaction.options.getString('query');
      const isUrl = /^https?:\/\//i.test(rawQuery);
      const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;
      const voiceChannel = interaction.member.voice.channel;

      let player = client.manager.players.get(interaction.guild.id);
      const botVcId = interaction.guild.members.me?.voice?.channelId;

      if (player && !botVcId) {
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
        // Update text channel if the user is issuing the command from a different channel
        const prevChannelId = player.data.get('textChannel');
        if (prevChannelId && prevChannelId !== interaction.channel.id) {
          player.data.set('textChannel', interaction.channel.id);
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
          // Also move the control panel to the new channel
          player.data.delete('controlMessageId');
          player.data.delete('controlMessageChannelId');
        }
      }

      let result;
      try {
        // Pass source: '' so Kazagumo does not add its own prefix on top of the one we already set
        result = await client.manager.search(query, { requester: interaction.user, source: '' });
      } catch {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
      }

      if (!result || !result.tracks.length) {
        return interaction.editReply({ embeds: [buildErrorEmbed(`No results found on ${platformLabel}.`)] });
      }

      // Mark tracks as wide (16:9) if this command uses YouTube search
      if (useWide) {
        for (const t of result.tracks) t.useWide = true;
      }

      const wasIdle = !player.playing && !player.paused;
      const settings = getSettings(interaction.guild.id);

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) player.queue.add(track);
        if (!wasIdle) {
          // Prefer artworkUrl (1:1 square album art) over thumbnail (16:9 video) for non-yt sources.
          // For yt (useWide=true), keep thumbnail priority so the 16:9 art is used.
          const firstTrack = result.tracks[0];
          const artUrl = useWide
            ? (firstTrack?.thumbnail || firstTrack?.artworkUrl)
            : (firstTrack?.artworkUrl || firstTrack?.thumbnail);
          const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
          await interaction.editReply(payload);
          setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
          // Send/update the control panel so users can interact immediately
          refreshControlPanel(client, interaction.channel, player, settings).catch(() => {});
          return;
        }
        // wasIdle: must editReply before deleteReply (Discord API requirement for deferred replies)
        await interaction.editReply({ content: '▶️ Playing playlist...' }).catch(() => {});
        await interaction.deleteReply().catch(() => {});
      } else {
        const track = result.tracks[0];
        player.queue.add(track);
        if (!wasIdle) {
          const queueSize = player.queue.size ?? player.queue.length;
          const payload = buildAddedToQueueV2(track, queueSize);
          await interaction.editReply(payload);
          setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
          // Send/update the control panel so users can interact immediately
          refreshControlPanel(client, interaction.channel, player, settings).catch(() => {});
          return;
        }
        // wasIdle: must editReply before deleteReply
        await interaction.editReply({ content: '▶️ Playing...' }).catch(() => {});
        await interaction.deleteReply().catch(() => {});
      }

      if (wasIdle) await player.play();
    },
  };
}

/**
 * Build a platform-specific prefix play command.
 * @param {string} name - Command name (e.g. 'yt')
 * @param {string[]} aliases - Command aliases
 * @param {string} description - Human-readable description
 * @param {string} searchPrefix - Kazagumo/LavaSrc search prefix (e.g. 'ytsearch:')
 * @param {string} platformLabel - Display label (e.g. 'YouTube')
 * @param {object} [opts={}] - Additional options
 * @param {boolean} [opts.useWide=false] - Whether tracks from this command use 16:9 thumbnails
 */
function buildPlatformPrefixCommand(name, aliases, description, searchPrefix, platformLabel, opts = {}) {
  const useWide = opts.useWide === true;
  return {
    name,
    aliases,
    description,
    usage: `<song name>`,

    async run(client, message, args) {
      if (!args.length) {
        return message.channel.send({ embeds: [buildErrorEmbed(`Please provide a song name to search on ${platformLabel}.`)] });
      }

      const voiceCheck = checkVoice(message.member, message.guild);
      if (!voiceCheck.ok) {
        return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
      }

      const rawQuery = args.join(' ');
      const isUrl = /^https?:\/\//i.test(rawQuery);
      const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;
      const voiceChannel = message.member.voice.channel;

      // Item 7: Send a "Searching..." message instead of the typing indicator
      const searchMsg = await message.channel.send({ content: `🔍 Searching for \`${rawQuery}\` on ${platformLabel}...` });

      let player = client.manager.players.get(message.guild.id);
      const botVcId = message.guild.members.me?.voice?.channelId;

      if (player && !botVcId) {
        try { await player.shoukaku?.node?.destroyPlayer(message.guild.id); } catch {}
        try { await client.manager.shoukaku?.leaveVoiceChannel(message.guild.id); } catch {}
        try { await player.destroy(); } catch {}
        client.manager.players.delete(message.guild.id);
        player = null;
      }

      if (!player) {
        player = await client.manager.createPlayer({
          guildId: message.guild.id,
          voiceId: voiceChannel.id,
          textId: message.channel.id,
          deaf: true,
          shardId: message.guild.shardId ?? 0,
        });
        player.data.set('textChannel', message.channel.id);
      } else {
        const prevChannelId = player.data.get('textChannel');
        if (prevChannelId && prevChannelId !== message.channel.id) {
          player.data.set('textChannel', message.channel.id);
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
          // Also move the control panel to the new channel
          player.data.delete('controlMessageId');
          player.data.delete('controlMessageChannelId');
        }
      }

      let result;
      try {
        // Pass source: '' so Kazagumo does not add its own prefix on top of the one we already set
        result = await client.manager.search(query, { requester: message.author, source: '' });
      } catch (error) {
        console.error(`[prefix ${name}] Search error:`, error);
        await searchMsg.edit({ content: `❌ Failed to search for that track.` }).catch(() => {});
        return;
      }

      if (!result || !result.tracks.length) {
        await searchMsg.edit({ content: `❌ No results found on ${platformLabel}.` }).catch(() => {});
        return;
      }

      // Mark tracks as wide (16:9) if this command uses YouTube search
      if (useWide) {
        for (const t of result.tracks) t.useWide = true;
      }

      // Delete the searching message now that we have results
      searchMsg.delete().catch(() => {});

      const wasIdle = !player.playing && !player.paused;
      const settings = getSettings(message.guild.id);

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) player.queue.add(track);
        if (!wasIdle) {
          const artUrl = result.tracks[0]?.thumbnail || result.tracks[0]?.artworkUrl;
          const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
          const reply = await message.channel.send({ ...payload, allowedMentions: { repliedUser: false } });
          setTimeout(() => reply.delete().catch(() => {}), 15000);
          if (!player.playing && !player.paused) await player.play();
          // Send/update the control panel so users can interact immediately
          refreshControlPanel(client, message.channel, player, settings).catch(() => {});
          return;
        }
      } else {
        const track = result.tracks[0];
        player.queue.add(track);
        if (!wasIdle) {
          const queueSize = player.queue.length;
          const payload = buildAddedToQueueV2(track, queueSize);
          const reply = await message.channel.send({ ...payload, allowedMentions: { repliedUser: false } });
          setTimeout(() => reply.delete().catch(() => {}), 15000);
          if (!player.playing && !player.paused) await player.play();
          // Send/update the control panel so users can interact immediately
          refreshControlPanel(client, message.channel, player, settings).catch(() => {});
          return;
        }
      }

      if (wasIdle) await player.play();
    },
  };
}

module.exports = { buildPlatformPlayCommand, buildPlatformPrefixCommand };
