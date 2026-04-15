const config = require('../../../config');
const { buildErrorEmbed } = require('../../utils/embeds');
const { getSetup, getSettings, hasNoPrefix, getPrefixes } = require('../../utils/setupManager');
const { logToWebhook } = require('../../utils/webhookLogger');
const { incrementBuryCount } = require('../../utils/panelUpdater');

// Map short platform prefixes to Kazagumo/LavaSrc search prefixes
const PLATFORM_PREFIXES = {
  yt: 'ytsearch:',
  ytm: 'ytmsearch:',
  sp: 'spsearch:',
  ap: 'amsearch:',
  sc: 'scsearch:',
  dz: 'dzsearch:',
  az: 'amzsearch:',
  js: 'jssearch:',
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
      let query;
      const firstWord = content.split(/\s+/)[0].toLowerCase();
      const rest = content.split(/\s+/).slice(1).join(' ').trim();
      if (PLATFORM_PREFIXES[firstWord] && rest) {
        query = `${PLATFORM_PREFIXES[firstWord]}${rest}`;
      } else if (/^https?:\/\//i.test(content)) {
        query = content;
      } else {
        // Use the guild's stored playback source, or fall back to config default
        const guildSettings = getSettings(message.guild.id);
        const searchPrefix = guildSettings.playbackSource || `${config.player.defaultSearchPlatform}:`;
        query = `${searchPrefix}${content}`;
      }

      let player = client.manager.players.get(message.guild.id);

      // If a player exists but bot was manually disconnected from VC, nuke it fully so we can rejoin
      const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
      if (player && !botVoiceChannelId) {
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
          textId: setupInfo.channelId,
          deaf: true,
          shardId: message.guild.shardId ?? 0,
        });
        player.data.set('textChannel', setupInfo.channelId);
      }

      let result;
      try {
        console.log(`[messageCreate/setup] Searching: "${query}" for guild "${message.guild.id}"`);
        // Pass source: '' so Kazagumo does not add its own prefix on top of the one already in query
        result = await client.manager.search(query, { requester: message.author, source: '' });
        console.log(`[messageCreate/setup] Result: type=${result?.type}, tracks=${result?.tracks?.length ?? 0}`);
      } catch (err) {
        console.error(`[messageCreate/setup] Search threw:`, err);
        logToWebhook({
          title: '🚨 Setup Channel Search Exception',
          color: 0xed4245,
          fields: [
            { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
            { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
            { name: 'Query', value: query },
            { name: 'Error', value: (err?.stack || String(err)).slice(0, 1000) },
          ],
        }).catch(() => {});
        const err2 = await message.channel.send({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
        setTimeout(() => err2.delete().catch(() => {}), 5000);
        return;
      }

      if (!result || !result.tracks.length) {
        console.warn(`[messageCreate/setup] No results for: "${query}"`);
        logToWebhook({
          title: '❌ Setup Channel – No Results',
          color: 0xed4245,
          fields: [
            { name: 'Guild', value: `${message.guild.name} (${message.guild.id})`, inline: true },
            { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
            { name: 'Query', value: query },
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
    // Increment bury count for non-bot messages (sticky NP message logic)
    const playerForBury = client.manager?.players?.get(message.guild.id);
    if (playerForBury) {
      incrementBuryCount(playerForBury, message.channelId);
    }

    // Determine which prefix(es) are active for this guild
    // getPrefixes returns [config.botSetup.prefix] if no custom prefix is set,
    // so the default '!' still works unless a guild has set a custom prefix via /prefix
    const guildPrefixes = getPrefixes(message.guild.id);

    // Find which prefix (if any) was used
    let usedPrefix = null;
    for (const p of guildPrefixes) {
      if (message.content.startsWith(p)) {
        usedPrefix = p;
        break;
      }
    }

    // No-prefix check: if the user has no-prefix access, treat entire message as a command
    const userHasNoPrefix = hasNoPrefix(message.author.id);
    let args, commandName;

    if (usedPrefix) {
      args = message.content.slice(usedPrefix.length).trim().split(/\s+/);
      commandName = args.shift().toLowerCase();
    } else if (userHasNoPrefix) {
      // No prefix used – treat the whole message as a command if it matches one
      args = message.content.trim().split(/\s+/);
      commandName = args.shift().toLowerCase();
      // Only proceed if there's an actual command registered
      if (!client.commands.has(commandName)) return;
    } else {
      return;
    }

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.run(client, message, args);
    } catch (error) {
      console.error(`[MessageCreate] Error in prefix command "${commandName}":`, error);
      await message.channel.send({ embeds: [buildErrorEmbed('An error occurred while running that command.')] }).catch(() => {});
    }
  },
};
