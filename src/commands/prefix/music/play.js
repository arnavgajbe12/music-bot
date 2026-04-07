const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');
const config = require('../../../../config');

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

    // Use the guild's stored playback source, or fall back to config default
    const settings = getSettings(message.guild.id);
    const searchPrefix = settings.playbackSource || `${config.player.defaultSearchPlatform}:`;
    const isUrl = /^https?:\/\//i.test(rawQuery);
    const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;

    let result;
    try {
      result = await client.manager.search(query, { requester: message.author });
    } catch (error) {
      console.error('[prefix play] Search error:', error);
      return message.reply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
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
        const queueSize = player.queue.size;
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
