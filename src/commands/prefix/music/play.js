const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');
const { getSettings } = require('../../../utils/setupManager');
const { logToWebhook } = require('../../../utils/webhookLogger');
const { refreshControlPanel } = require('../../../utils/panelUpdater');
const { METADATA_SOURCE_TO_PREFIX } = require('../../../utils/constants');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Play a song or add it to the queue.',
  usage: '<song name or URL>',

  async run(client, message, args) {
    if (!args.length) {
      return message.channel.send({ embeds: [buildErrorEmbed('Please provide a song name or URL.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const rawQuery = args.join(' ');
    const voiceChannel = message.member.voice.channel;

    // Item 7: Send a "Searching..." message instead of the typing indicator
    const searchMsg = await message.channel.send({ content: `🔍 Searching for \`${rawQuery}\`...` });

    let player = client.manager.players.get(message.guild.id);

    // If a player exists but the bot was manually disconnected from VC, destroy it so we can rejoin
    const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
    if (player && !botVoiceChannelId) {
      console.log(`[prefix play] Stale player detected in guild "${message.guild.id}" — destroying before rejoin.`);
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
      const channelChanged = prevChannelId && prevChannelId !== message.channel.id;
      // Always update the text channel to where !play was just used (item 3)
      player.data.set('textChannel', message.channel.id);
      // Clear old now-playing message reference so a new one is sent in this channel
      player.data.delete('nowPlayingMessage');
      player.data.delete('nowPlayingMessageId');
      player.data.delete('nowPlayingMessageChannelId');
      // Move the control panel to the new channel when user switches channels
      if (channelChanged) {
        player.data.delete('controlMessageId');
        player.data.delete('controlMessageChannelId');
      }
    }

    // Always use the guild metadata source for !play metadata lookups
    const settings = getSettings(message.guild.id);
    const searchPrefix = METADATA_SOURCE_TO_PREFIX[settings.metadataSource] || 'ytmsearch:';
    let result;
    try {
      const isUrl = /^https?:\/\//i.test(rawQuery);
      const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;
      console.log(`[prefix play] Searching with source "${searchPrefix}" → query: "${query}"`);
      // Pass source: '' so Kazagumo does not add its own prefix on top of the one we already set
      result = await client.manager.search(query, { requester: message.author, source: '' });
      console.log(`[prefix play] Search result: type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`);
    } catch (err) {
      console.error('[prefix play] Search threw an exception:', err);
      logToWebhook({
        title: '🚨 !play Search Exception',
        color: 0xed4245,
        fields: [
          { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
          { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
          { name: 'Query', value: rawQuery },
          { name: 'Search Source', value: searchPrefix },
          { name: 'Error', value: (err?.stack || String(err)).slice(0, 1000) },
        ],
      }).catch(() => {});
      await searchMsg.edit({ content: `❌ Failed to search for that track.` }).catch(() => {});
      return;
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
          { name: 'Search Source', value: searchPrefix },
          { name: 'Result Type', value: result?.type || 'null/undefined' },
          { name: 'Track Count', value: String(result?.tracks?.length ?? 0) },
        ],
      }).catch(() => {});
      await searchMsg.edit({ content: `❌ No results found for \`${rawQuery}\`.` }).catch(() => {});
      return;
    }

    console.log(`[prefix play] ✅ Found result: type=${result.type}, tracks=${result.tracks.length} in guild "${message.guild.id}"`);

    // Delete the searching message now that we have results
    searchMsg.delete().catch(() => {});

    const wasIdle = !player.playing && !player.paused;

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      if (!wasIdle) {
        const artUrl = result.tracks[0]?.thumbnail || result.tracks[0]?.artworkUrl;
        const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
        // Item 6: no user ping
        await message.channel.send({ ...payload, allowedMentions: { repliedUser: false } });
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
        // Item 6: no user ping
        await message.channel.send({ ...payload, allowedMentions: { repliedUser: false } });
        if (!player.playing && !player.paused) await player.play();
        // Send/update the control panel so users can interact immediately
        refreshControlPanel(client, message.channel, player, settings).catch(() => {});
        return;
      }
    }

    if (wasIdle) {
      await player.play();
      refreshControlPanel(client, message.channel, player, settings).catch(() => {});
    }
  },
};
