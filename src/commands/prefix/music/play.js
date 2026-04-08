const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice, searchWithFallback } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');
const { logToWebhook } = require('../../../utils/webhookLogger');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Play a song or add it to the queue.',
  usage: '<song name or URL>',

  async run(client, message, args) {
    if (!args.length) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a song name or URL.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const rawQuery = args.join(' ');
    const voiceChannel = message.member.voice.channel;

    await message.channel.sendTyping();

    let player = client.manager.players.get(message.guild.id);

    // If a player exists but the bot was manually disconnected from VC, destroy it so we can rejoin
    const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
    if (player && !botVoiceChannelId) {
      console.log(`[prefix play] Stale player detected in guild "${message.guild.id}" — destroying before rejoin.`);
      await player.destroy().catch(() => {});
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
      // Always update the text channel to where !play was just used (item 3)
      player.data.set('textChannel', message.channel.id);
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

    // Use per-guild playback source if set, otherwise use the ytmsearch → ytsearch → scsearch fallback
    const settings = getSettings(message.guild.id);
    let result;
    try {
      if (settings.playbackSource) {
        const isUrl = /^https?:\/\//i.test(rawQuery);
        const query = isUrl ? rawQuery : `${settings.playbackSource}${rawQuery}`;
        console.log(`[prefix play] Searching with guild source "${settings.playbackSource}" → query: "${query}"`);
        // Pass source: '' so Kazagumo does not add its own prefix on top of the one we already set
        result = await client.manager.search(query, { requester: message.author, source: '' });
        console.log(`[prefix play] Primary search result: type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`);
        // If no tracks found with configured source, fall back to the default chain
        if (!result || !result.tracks.length) {
          console.log(`[prefix play] Primary source returned no tracks, trying fallback chain...`);
          result = await searchWithFallback(client.manager, rawQuery, message.author);
        }
      } else {
        console.log(`[prefix play] No guild source configured, using fallback chain for: "${rawQuery}"`);
        result = await searchWithFallback(client.manager, rawQuery, message.author);
      }
    } catch (err) {
      console.error('[prefix play] Search threw an exception:', err);
      logToWebhook({
        title: '🚨 !play Search Exception',
        color: 0xed4245,
        fields: [
          { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
          { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
          { name: 'Query', value: rawQuery },
          { name: 'Playback Source', value: settings.playbackSource || '(none — using fallback)' },
          { name: 'Error', value: (err?.stack || String(err)).slice(0, 1000) },
        ],
      }).catch(() => {});
      try {
        result = await searchWithFallback(client.manager, rawQuery, message.author);
      } catch (err2) {
        console.error('[prefix play] Fallback search also threw:', err2);
        return message.reply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
      }
    }

    if (!result || !result.tracks.length) {
      console.warn(`[prefix play] ❌ No results for query: "${rawQuery}" in guild "${message.guild.id}"`);
      logToWebhook({
        title: '❌ !play – No Results',
        color: 0xed4245,
        fields: [
          { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
          { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
          { name: 'Query', value: rawQuery },
          { name: 'Playback Source', value: settings.playbackSource || '(none — using fallback)' },
          { name: 'Result Type', value: result?.type || 'null/undefined' },
          { name: 'Track Count', value: String(result?.tracks?.length ?? 0) },
        ],
      }).catch(() => {});
      return message.reply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    console.log(`[prefix play] ✅ Found result: type=${result.type}, tracks=${result.tracks.length} in guild "${message.guild.id}"`);

    const wasIdle = !player.playing && !player.paused;

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      if (!wasIdle) {
        const artUrl = result.tracks[0]?.thumbnail || result.tracks[0]?.artworkUrl;
        const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
        const reply = await message.reply(payload);
        setTimeout(() => reply.delete().catch(() => {}), 15000);
        if (!player.playing && !player.paused) await player.play();
        return;
      }
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (!wasIdle) {
        const queueSize = player.queue.size ?? player.queue.length;
        const payload = buildAddedToQueueV2(track, queueSize);
        const reply = await message.reply(payload);
        setTimeout(() => reply.delete().catch(() => {}), 15000);
        if (!player.playing && !player.paused) await player.play();
        return;
      }
    }

    if (wasIdle) await player.play();
  },
};
