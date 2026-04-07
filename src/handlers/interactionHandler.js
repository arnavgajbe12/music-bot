const { EmbedBuilder } = require('discord.js');
const { buildErrorEmbed, resolvePlatformEmoji, resolveSourceDisplayName, formatDuration } = require('../utils/embeds');
const { buildPlayerButtonsV2, buildQueueV2, buildPlayNextConfirmV2, buildNowPlayingV2, buildSetupNowPlayingV2, buildSetupButtonsV2, extractDominantColor } = require('../utils/componentBuilder');
const { getSettings, getSetup } = require('../utils/setupManager');
const config = require('../../config');

/**
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    // ── Slash Commands ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.run(client, interaction);
      } catch (error) {
        console.error(`[InteractionHandler] Error in slash command "${interaction.commandName}":`, error);
        const errEmbed = buildErrorEmbed('An error occurred while running that command.');
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── String Select Menus ────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'help_category') {
        try {
          const { buildCategoryEmbed, buildSelectMenu } = require('../commands/slash/general/help');
          const selected = interaction.values[0];
          const embed = buildCategoryEmbed(selected);
          const row = buildSelectMenu(selected);
          await interaction.update({ embeds: [embed], components: [row] });
        } catch (error) {
          console.error('[InteractionHandler] help_category select error:', error);
          await interaction.reply({ embeds: [buildErrorEmbed('Could not load that category.')], ephemeral: true }).catch(() => {});
        }
        return;
      }

      if (interaction.customId === 'source_metadata' || interaction.customId === 'source_playback') {
        try {
          const { updateSettings, getSettings } = require('../utils/setupManager');
          const { buildSourcePanel } = require('../commands/slash/general/source');
          const guildId = interaction.guild.id;
          const selected = interaction.values[0];

          if (interaction.customId === 'source_metadata') {
            updateSettings(guildId, { metadataSource: selected });
          } else {
            updateSettings(guildId, { playbackSource: selected });
          }

          const settings = getSettings(guildId);
          const panel = buildSourcePanel(
            settings.metadataSource || 'youtube',
            settings.playbackSource || 'ytmsearch:',
          );
          await interaction.update(panel);
        } catch (error) {
          console.error('[InteractionHandler] source select error:', error);
          await interaction.reply({ embeds: [buildErrorEmbed('Could not update source setting.')], ephemeral: true }).catch(() => {});
        }
        return;
      }

      // ── Queue track selection – move to play next ──────────────────────────
      if (interaction.customId === 'queue_select') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        const trackIndex = parseInt(interaction.values[0], 10);
        const tracks = [...player.queue];

        if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= tracks.length) {
          return interaction.reply({ embeds: [buildErrorEmbed('That track is no longer in the queue.')], ephemeral: true });
        }

        // Remove from current position and unshift to front
        const [movedTrack] = tracks.splice(trackIndex, 1);
        player.queue.unshift(movedTrack);

        // Rebuild the queue panel on the same message (stay on page 1 after move)
        const updatedTracks = [...player.queue];
        const queuePayload = buildQueueV2(player.queue.current, updatedTracks, 1);
        await interaction.update(queuePayload);

        // Send an ephemeral confirmation popup
        const confirmPayload = buildPlayNextConfirmV2(movedTrack);
        await interaction.followUp({ ...confirmPayload, ephemeral: true });
        return;
      }

      // ── "More Options" dropdown on the Now Playing panel ──────────────────
      if (interaction.customId === 'player_more_options') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        // Require user to be in the same voice channel
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        const selected = interaction.values[0];

        switch (selected) {
          case 'loop_toggle': {
            // Cycle: none → track → queue → none
            const current = player.loop || 'none';
            let newMode;
            if (current === 'none') newMode = 'track';
            else if (current === 'track') newMode = 'queue';
            else newMode = 'none';
            player.setLoop(newMode);

            const modeLabels = {
              none: `${config.emojis.stop} **Off**`,
              track: `${config.emojis.loop} **Track**`,
              queue: `${config.emojis.loop} **Queue**`,
            };

            // Update the Now Playing message to reflect the new loop state
            try {
              const settings = getSettings(interaction.guild.id);
              const setupInfo = getSetup(interaction.guild.id);
              let payload;
              if (setupInfo && interaction.message?.id === setupInfo.messageId) {
                const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
                const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
                payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
              } else {
                payload = buildNowPlayingV2(player.queue.current, player, settings.largeArt);
              }
              await interaction.update(payload);
            } catch {
              await interaction.deferUpdate().catch(() => {});
            }

            await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setDescription(`🔁 Loop mode set to ${modeLabels[newMode] || newMode}.`),
              ],
              ephemeral: true,
            });
            break;
          }

          case 'song_info': {
            await interaction.deferUpdate();
            const track = player.queue.current;
            const platformEmoji = resolvePlatformEmoji(track.sourceName);
            const sourceDisplay = resolveSourceDisplayName(track.sourceName);
            const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;
            const requester = track.requester;
            const requesterName = requester
              ? requester.displayName || requester.username || requester.tag || 'Unknown'
              : 'Unknown';

            const infoEmbed = new EmbedBuilder()
              .setColor(config.embeds.color)
              .setAuthor({ name: `${platformEmoji} Song Info` })
              .setTitle(track.title)
              .setURL(track.uri || null)
              .addFields(
                { name: '🎤 Artist', value: track.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: formatDuration(track.length), inline: true },
                { name: 'Source', value: `${platformEmoji} ${sourceDisplay}`, inline: true },
                { name: '👤 Requested by', value: requesterName, inline: true },
              )
              .setThumbnail(artUrl)
              .setFooter({ text: config.embeds.footerText });

            await interaction.followUp({ embeds: [infoEmbed], ephemeral: true });
            break;
          }

          case 'shuffle_queue': {
            await interaction.deferUpdate();
            // Kazagumo queue extends Array — shuffle in place
            const queueArr = [...player.queue];
            for (let i = queueArr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [queueArr[i], queueArr[j]] = [queueArr[j], queueArr[i]];
            }
            player.queue.splice(0, player.queue.length, ...queueArr);

            await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setDescription(`${config.emojis.shuffle} Queue shuffled! **${queueArr.length}** track(s) reordered.`),
              ],
              ephemeral: true,
            });
            break;
          }

          case 'view_queue': {
            await interaction.deferUpdate();
            const tracks = [...player.queue];
            const queuePayload = buildQueueV2(player.queue.current, tracks, 1);
            await interaction.followUp({ ...queuePayload, ephemeral: true });
            break;
          }

          default:
            await interaction.reply({ embeds: [buildErrorEmbed('Unknown option selected.')], ephemeral: true });
        }
        return;
      }

      return;
    }

    // ── Button Interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId, guild, member } = interaction;

      // ── Queue pagination navigation ──────────────────────────────────────
      if (customId.startsWith('queue_nav:')) {
        const player = client.manager.players.get(guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }
        const page = parseInt(customId.split(':')[1], 10);
        const tracks = [...player.queue];
        const payload = buildQueueV2(player.queue.current, tracks, page);
        return interaction.update(payload);
      }

      const validIds = ['player_previous', 'player_pause', 'player_skip', 'player_stop'];
      if (!validIds.includes(customId)) return;

      const player = client.manager.players.get(guild.id);
      if (!player) {
        return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
      }

      // Require user to be in the same voice channel
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel || voiceChannel.id !== player.voiceId) {
        return interaction.reply({
          embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      try {
        switch (customId) {
          case 'player_previous': {
            // player.queue.previous is an array (most recent first)
            const hasPrev = Array.isArray(player.queue.previous)
              ? player.queue.previous.length > 0
              : player.queue.previous != null;

            if (!hasPrev) {
              // No previous track — restart current from 0:00
              await player.shoukaku.seekTo(0);
            } else {
              // Get and remove the most recent previous track from history
              const prevTrack = player.getPrevious
                ? player.getPrevious(true)
                : (Array.isArray(player.queue.previous)
                    ? player.queue.previous.shift()
                    : player.queue.previous);

              if (prevTrack) {
                // replaceCurrent: false → current song is unshifted back to position 0
                // of the queue so it can still be played after the previous track
                await player.play(prevTrack, { replaceCurrent: false });
              }
            }
            break;
          }
          case 'player_pause': {
            player.pause(!player.paused);
            break;
          }
          case 'player_skip': {
            await player.skip();
            break;
          }
          case 'player_stop': {
            player.queue.clear();
            await player.skip();
            break;
          }
        }

        // Update the button row on the now-playing message to reflect new state
        if (interaction.message?.editable && player.queue.current) {
          const settings = getSettings(guild.id);
          const setupInfo = getSetup(guild.id);

          let payload;
          if (setupInfo && interaction.message.id === setupInfo.messageId) {
            // Setup channel panel — use setup-specific builder
            const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
            const accentColor = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
            payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
          } else {
            payload = buildNowPlayingV2(player.queue.current, player, settings.largeArt);
          }
          await interaction.message.edit(payload).catch(() => {});
        }
      } catch (error) {
        console.error('[InteractionHandler] Button error:', error);
      }
    }
  });
};
