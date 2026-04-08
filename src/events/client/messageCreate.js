const config = require('../../../config');
const { buildErrorEmbed } = require('../../utils/embeds');
const { getSetup, getSettings } = require('../../utils/setupManager');
const { logToWebhook } = require('../../utils/webhookLogger');

// Map short platform prefixes to Kazagumo/LavaSrc search prefixes
const PLATFORM_PREFIXES = {
  yt: 'ytsearch:',
  ytm: 'ytmsearch:',
  sp: 'spsearch:',
  ap: 'amsearch:',
  sc: 'scsearch:',
  dz: 'dzsearch:',
  az: 'amzsearch:',
};

module.exports = {
  once: false,
  async run(client, message) {
    if (message.author.bot || !message.guild) return;

    // ── Setup Channel: Song Request Handler ────────────────────────────────
    const setupInfo = getSetup(message.guild.id);
    if (setupInfo && message.channelId === setupInfo.channelId) {
      // Delete the user's message to keep the channel clean
      message.delete().catch(() => {});

      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        const err = await message.channel.send({ embeds: [buildErrorEmbed('You need to be in a voice channel to request songs.')] });
        setTimeout(() => err.delete().catch(() => {}), 5000);
        return;
      }

      const content = message.content.trim();
      if (!content) return;

      // Check for platform prefix (e.g. "yt Blinding Lights")
      let searchQuery = content;
      let searchSource;
      const firstWord = content.split(/\s+/)[0].toLowerCase();
      const rest = content.split(/\s+/).slice(1).join(' ').trim();
      if (PLATFORM_PREFIXES[firstWord] && rest) {
        // e.g. "yt Blinding Lights" → source='ytsearch:', query='Blinding Lights'
        searchSource = PLATFORM_PREFIXES[firstWord];
        searchQuery = rest;
      } else if (/^https?:\/\//i.test(content)) {
        // Direct URL — pass through without a source prefix
        searchQuery = content;
        searchSource = undefined;
      } else {
        // Use the guild's stored playback source, or fall back to config default
        const guildSettings = getSettings(message.guild.id);
        searchSource = guildSettings.playbackSource || `${config.player.defaultSearchPlatform}:`;
        searchQuery = content;
      }

      let player = client.manager.players.get(message.guild.id);

      // If a player exists but bot was manually disconnected from VC, destroy and recreate
      const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
      if (player && !botVoiceChannelId) {
        await player.destroy().catch(() => {});
        player = null;
      }

      if (!player) {
        player = await client.manager.createPlayer({
          guildId: message.guild.id,
          voiceId: voiceChannel.id,
          textId: setupInfo.channelId,
          deaf: true,
          shardId: message.guild.shardId ?? 0,
        });
        player.data.set('textChannel', setupInfo.channelId);
      }

      let result;
      try {
        console.log(`[messageCreate/setup] Searching: source="${searchSource || 'none'}" query="${searchQuery}" for guild "${message.guild.id}"`);
        // Pass source via options so Kazagumo doesn't double-prefix (it would otherwise prepend 'ytsearch:' on top of our prefix)
        result = await client.manager.search(searchQuery, { requester: message.author, source: searchSource });
        console.log(`[messageCreate/setup] Result: type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`);
      } catch (err) {
        console.error(`[messageCreate/setup] Search threw:`, err);
        logToWebhook({
          title: '🚨 Setup Channel Search Exception',
          color: 0xed4245,
          fields: [
            { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
            { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
            { name: 'Query', value: searchQuery },
            { name: 'Error', value: (err?.stack || String(err)).slice(0, 1000) },
          ],
        }).catch(() => {});
        const err2 = await message.channel.send({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
        setTimeout(() => err2.delete().catch(() => {}), 5000);
        return;
      }

      if (!result || !result.tracks.length) {
        console.warn(`[messageCreate/setup] No results for: source="${searchSource}" query="${searchQuery}"`);
        logToWebhook({
          title: '❌ Setup Channel – No Results',
          color: 0xed4245,
          fields: [
            { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
            { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
            { name: 'Query', value: searchQuery },
            { name: 'Result Type', value: result?.type || 'null/undefined' },
          ],
        }).catch(() => {});
        const err2 = await message.channel.send({ embeds: [buildErrorEmbed('No results found.')] });
        setTimeout(() => err2.delete().catch(() => {}), 5000);
        return;
      }

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) player.queue.add(track);
      } else {
        player.queue.add(result.tracks[0]);
      }

      if (!player.playing && !player.paused) await player.play();
      return;
    }

    // ── Prefix Command Handler ─────────────────────────────────────────────
    if (!message.content.startsWith(config.botSetup.prefix)) return;

    const args = message.content.slice(config.botSetup.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.run(client, message, args);
    } catch (error) {
      console.error(`[MessageCreate] Error in prefix command "${commandName}":`, error);
      await message.reply({ embeds: [buildErrorEmbed('An error occurred while running that command.')] }).catch(() => {});
    }
  },
};
