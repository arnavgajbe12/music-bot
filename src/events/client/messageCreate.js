const config = require('../../../config');
const { buildErrorEmbed } = require('../../utils/embeds');
const { getSetup, getSettings } = require('../../utils/setupManager');
const { searchWithFallback } = require('../../utils/functions');

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

      let player = client.manager.players.get(message.guild.id);
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

      // Determine search query: explicit platform prefix, URL, or fallback chain
      let result;
      try {
        const firstWord = content.split(/\s+/)[0].toLowerCase();
        const rest = content.split(/\s+/).slice(1).join(' ').trim();
        if (PLATFORM_PREFIXES[firstWord] && rest) {
          // Explicit platform prefix (e.g. "yt Blinding Lights")
          result = await client.manager.search(`${PLATFORM_PREFIXES[firstWord]}${rest}`, { requester: message.author });
          if (!result || !result.tracks.length) {
            result = await searchWithFallback(client.manager, rest, message.author);
          }
        } else if (/^https?:\/\//i.test(content)) {
          // Direct URL – use as-is
          result = await client.manager.search(content, { requester: message.author });
        } else {
          // Plain text query – use the guild's configured source then fall back
          const guildSettings = getSettings(message.guild.id);
          if (guildSettings.playbackSource) {
            result = await client.manager.search(`${guildSettings.playbackSource}${content}`, { requester: message.author });
          }
          if (!result || !result.tracks.length) {
            result = await searchWithFallback(client.manager, content, message.author);
          }
        }
      } catch {
        try {
          result = await searchWithFallback(client.manager, content, message.author);
        } catch (err) {
          console.error('[messageCreate] Setup channel search error:', err);
        }
      }

      if (!result || !result.tracks.length) {
        const err = await message.channel.send({ embeds: [buildErrorEmbed('No results found.')] });
        setTimeout(() => err.delete().catch(() => {}), 5000);
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
