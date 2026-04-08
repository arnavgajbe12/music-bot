const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice, searchWithFallback } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');

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
      // Update text channel if the user is issuing the command from a different channel
      const prevChannelId = player.data.get('textChannel');
      if (prevChannelId && prevChannelId !== message.channel.id) {
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
    }

    // Use per-guild playback source if set, otherwise use the ytmsearch → ytsearch → scsearch fallback
    const settings = getSettings(message.guild.id);
    let result;
    try {
      if (settings.playbackSource) {
        const isUrl = /^https?:\/\//i.test(rawQuery);
        const query = isUrl ? rawQuery : `${settings.playbackSource}${rawQuery}`;
        result = await client.manager.search(query, { requester: message.author });
        // If no tracks found with configured source, fall back to the default chain
        if (!result || !result.tracks.length) {
          result = await searchWithFallback(client.manager, rawQuery, message.author);
        }
      } else {
        result = await searchWithFallback(client.manager, rawQuery, message.author);
      }
    } catch {
      try {
        result = await searchWithFallback(client.manager, rawQuery, message.author);
      } catch (err) {
        console.error('[prefix play] Search error:', err);
        return message.reply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
      }
    }

    if (!result || !result.tracks.length) {
      return message.reply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

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
