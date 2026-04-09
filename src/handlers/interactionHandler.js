const { EmbedBuilder } = require('discord.js');
const { buildErrorEmbed, resolvePlatformEmoji, resolveSourceDisplayName, formatDuration } = require('../utils/embeds');
const {
  buildPlayerButtonsV2,
  buildQueueV2,
  buildQueueStandaloneV2,
  buildPlayNextConfirmV2,
  buildNowPlayingV2,
  buildSetupNowPlayingV2,
  buildSetupQueueViewV2,
  buildSetupButtonsV2,
  extractDominantColor,
  buildConfirmV2,
} = require('../utils/componentBuilder');
const { getSettings, getSetup } = require('../utils/setupManager');
const config = require('../../config');

/**
 * Get the cached accent color for a player, or extract it from the thumbnail URL.
 * Caches the result in player.data for subsequent calls.
 * @param {object} player - KazagumoPlayer
 * @param {string|null} artUrl - Thumbnail URL
 * @returns {Promise<number>} Integer color value
 */
async function resolveAccentColor(player, artUrl) {
  const cached = player.data.get('accentColor');
  if (cached != null) return cached;
  const color = await extractDominantColor(artUrl).catch(() => Math.floor(Math.random() * 0xffffff));
  player.data.set('accentColor', color);
  return color;
}

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
              const controlMsgId = player.data.get('controlMessageId');
              const isSetupMsg = setupInfo && interaction.message?.id === setupInfo.messageId;
              const isControlMsg = controlMsgId && interaction.message?.id === controlMsgId;
              let payload;
              if (isSetupMsg) {
                const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
                const accentColor = await resolveAccentColor(player, artUrl);
                payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
              } else if (isControlMsg) {
                payload = buildNowPlayingV2(player.queue.current, player, settings.largeArt);
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

      // ── "Recommend" dropdown in setup channel queue view ─────────────────
      if (interaction.customId === 'setup_recommend_select') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        const val = interaction.values[0]; // format: "rec:<i>"
        const recommendations = player.data.get('setupRecommendations') || [];
        const parts = val.split(':');
        const recIdx = parseInt(parts[1], 10);
        const recTrack = recommendations[recIdx];

        if (!recTrack) {
          return interaction.reply({ embeds: [buildErrorEmbed('That recommendation is no longer available.')], ephemeral: true });
        }

        player.queue.add(recTrack);
        await interaction.deferUpdate();
        return interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor(config.embeds.color)
              .setDescription(`✨ Added **${recTrack.title}** by ${recTrack.author || 'Unknown'} to the queue.`),
          ],
          ephemeral: true,
        });
      }

      // ── Setup Channel: Controls dropdown (Row 3) ──────────────────────────
      if (interaction.customId === 'setup_controls') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        const selected = interaction.values[0];

        if (selected === 'loop_track') {
          const newMode = player.loop === 'track' ? 'none' : 'track';
          player.setLoop(newMode);
          const modeText = newMode === 'track' ? '🔂 **Track loop enabled**' : '⏹️ **Loop disabled**';
          await interaction.deferUpdate();
          return interaction.followUp({
            embeds: [new EmbedBuilder().setColor(config.embeds.color).setDescription(modeText)],
            ephemeral: true,
          });
        }

        if (selected === 'loop_queue') {
          const newMode = player.loop === 'queue' ? 'none' : 'queue';
          player.setLoop(newMode);
          const modeText = newMode === 'queue' ? '🔁 **Queue loop enabled**' : '⏹️ **Loop disabled**';
          await interaction.deferUpdate();
          return interaction.followUp({
            embeds: [new EmbedBuilder().setColor(config.embeds.color).setDescription(modeText)],
            ephemeral: true,
          });
        }

        if (selected === 'volume_info') {
          const currentVol = player.volume ?? 100;
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const volRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_vol_down').setEmoji('🔉').setLabel('-10').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup_vol_up').setEmoji('🔊').setLabel('+10').setStyle(ButtonStyle.Primary),
          );
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(config.embeds.color)
                .setTitle('🔊 Volume Control')
                .setDescription(`Current volume: **${currentVol}%**\nUse the buttons below to adjust.`)
                .setFooter({ text: config.embeds.footerText }),
            ],
            components: [volRow],
            ephemeral: true,
          });
        }

        if (selected === 'disconnect') {
          const channelName = interaction.guild.channels.cache.get(player.voiceId)?.name || 'voice channel';
          player.data.set('intentionalDisconnect', true);
          player.queue.clear();
          try { await player.destroy(); } catch { /* ignore */ }
          try {
            const botVoice = interaction.guild.members.me?.voice;
            if (botVoice?.channel) await botVoice.disconnect();
          } catch { /* ignore */ }
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0xed4245).setDescription(`👋 Disconnected from **${channelName}** and cleared the queue.`)],
            ephemeral: true,
          });
        }

        return interaction.deferUpdate().catch(() => {});
      }

      // ── Setup Channel: Manage Queue dropdown ──────────────────────────────
      if (interaction.customId === 'setup_manage_queue') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        const selected = interaction.values[0];

        if (selected === 'clear_queue') {
          const count = player.queue.length;
          player.queue.clear();
          await interaction.deferUpdate();
          // Refresh queue view
          const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
          const accentColor = await resolveAccentColor(player, artUrl);
          const tracks = [...player.queue];
          const recommendations = player.data.get('setupRecommendations') || [];
          const page = player.data.get('setupQueuePage') || 1;
          const payload = buildSetupQueueViewV2(player.queue.current, tracks, page, accentColor, player, recommendations);
          await interaction.editReply(payload).catch(() => {});
          return interaction.followUp({
            embeds: [new EmbedBuilder().setColor(config.embeds.color).setDescription(`🗑️ Cleared **${count}** track(s) from the queue.`)],
            ephemeral: true,
          });
        }

        if (selected === 'reverse_queue') {
          const queueArr = [...player.queue];
          queueArr.reverse();
          player.queue.splice(0, player.queue.length, ...queueArr);
          await interaction.deferUpdate();
          // Refresh queue view
          const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
          const accentColor = await resolveAccentColor(player, artUrl);
          const tracks = [...player.queue];
          const recommendations = player.data.get('setupRecommendations') || [];
          const page = player.data.get('setupQueuePage') || 1;
          const payload = buildSetupQueueViewV2(player.queue.current, tracks, page, accentColor, player, recommendations);
          await interaction.editReply(payload).catch(() => {});
          return interaction.followUp({
            embeds: [new EmbedBuilder().setColor(config.embeds.color).setDescription(`🔃 Queue reversed!`)],
            ephemeral: true,
          });
        }

        if (selected === 'remove_tracks') {
          const tracks = [...player.queue];
          if (tracks.length === 0) {
            return interaction.reply({ embeds: [buildErrorEmbed('There are no tracks in the queue to remove.')], ephemeral: true });
          }
          // Build multi-select menu (max 25 options)
          const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
          const SELECT_MAX = 100;
          const options = tracks.slice(0, 25).map((t, i) => {
            const raw = t.title || 'Unknown';
            const label = raw.length > SELECT_MAX ? raw.slice(0, SELECT_MAX - 3) + '...' : raw;
            const rawDesc = `${t.author || 'Unknown'} — ${formatDuration(t.length)}`;
            const desc = rawDesc.length > SELECT_MAX ? rawDesc.slice(0, SELECT_MAX - 3) + '...' : rawDesc;
            return new StringSelectMenuOptionBuilder().setLabel(label).setDescription(desc).setValue(String(i));
          });
          const removeRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('setup_queue_remove_select')
              .setPlaceholder('Select tracks to remove…')
              .setMinValues(1)
              .setMaxValues(Math.min(options.length, 25))
              .addOptions(options),
          );
          return interaction.reply({ components: [removeRow], ephemeral: true });
        }

        return interaction.deferUpdate().catch(() => {});
      }

      // ── Setup Channel: Remove-tracks multi-select ─────────────────────────
      if (interaction.customId === 'setup_queue_remove_select') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }
        const indices = interaction.values.map(Number).sort((a, b) => b - a); // descending so splice doesn't shift
        for (const idx of indices) {
          if (idx >= 0 && idx < player.queue.length) {
            player.queue.splice(idx, 1);
          }
        }
        await interaction.deferUpdate();
        // Refresh the setup queue panel if it's still showing
        try {
          const setupInfo = getSetup(interaction.guild.id);
          if (setupInfo) {
            const setupChannel = client.channels.cache.get(setupInfo.channelId);
            if (setupChannel?.isTextBased()) {
              const setupMsg = await setupChannel.messages.fetch(setupInfo.messageId).catch(() => null);
              if (setupMsg?.editable && player.data.get('setupQueueView')) {
                const artUrl = player.queue.current?.thumbnail || player.queue.current?.artworkUrl || null;
                const accentColor = await resolveAccentColor(player, artUrl);
                const tracks = [...player.queue];
                const recommendations = player.data.get('setupRecommendations') || [];
                const page = player.data.get('setupQueuePage') || 1;
                const payload = buildSetupQueueViewV2(player.queue.current, tracks, page, accentColor, player, recommendations);
                await setupMsg.edit(payload).catch(() => {});
              }
            }
          }
        } catch { /* non-fatal */ }
        return interaction.followUp({
          embeds: [new EmbedBuilder().setColor(config.embeds.color).setDescription(`❌ Removed **${indices.length}** track(s) from the queue.`)],
          ephemeral: true,
        });
      }

      return;
    }

    // ── Button Interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId, guild, member } = interaction;

      // ── Queue delete button ──────────────────────────────────────────────
      if (customId === 'queue_delete') {
        await interaction.deferUpdate().catch(() => {});
        return interaction.message.delete().catch(() => {});
      }

      // ── Standalone queue pagination ──────────────────────────────────────
      if (customId.startsWith('queue_standalone_nav:')) {
        const player = client.manager.players.get(guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }
        const page = parseInt(customId.split(':')[1], 10);
        const tracks = [...player.queue];
        const payload = buildQueueStandaloneV2(player.queue.current, tracks, page);
        return interaction.update(payload);
      }

      // ── Queue pagination navigation (more-options view queue) ──────────────────────────────────────
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

      // ── Setup channel queue view navigation ────────────────────────────────
      if (customId.startsWith('setup_queue_nav:')) {
        const setupInfo = getSetup(guild.id);
        const player = client.manager.players.get(guild.id);
        const controlMsgId = player?.data?.get('controlMessageId');
        const isSetupMsg = setupInfo && interaction.message.id === setupInfo.messageId;
        const isControlMsg = controlMsgId && interaction.message.id === controlMsgId;
        if (!isSetupMsg && !isControlMsg) return interaction.deferUpdate().catch(() => {});

        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        const page = parseInt(customId.split(':')[1], 10);
        const tracks = [...player.queue];
        const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
        const accentColor = await resolveAccentColor(player, artUrl);
        const payload = buildSetupQueueViewV2(player.queue.current, tracks, page, accentColor, player);
        player.data.set('setupQueuePage', page);
        return interaction.update(payload);
      }

      // ── Setup channel Row 2 buttons ────────────────────────────────────────
      const setupRow2Ids = ['setup_queue', 'setup_shuffle', 'setup_vol_down', 'setup_vol_up'];
      if (setupRow2Ids.includes(customId)) {
        const setupInfo = getSetup(guild.id);
        const player = client.manager.players.get(guild.id);
        const controlMsgId = player?.data?.get('controlMessageId');
        // setup_vol_down / setup_vol_up arrive from the ephemeral volume panel — allow from any message
        const isVolumeBtn = customId === 'setup_vol_down' || customId === 'setup_vol_up';
        const isSetupMsg = setupInfo && interaction.message.id === setupInfo.messageId;
        const isControlMsg = controlMsgId && interaction.message.id === controlMsgId;
        if (!isVolumeBtn && !isSetupMsg && !isControlMsg) {
          return interaction.reply({ embeds: [buildErrorEmbed('Setup panel not found.')], ephemeral: true });
        }

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

        if (customId === 'setup_queue') {
          // Toggle queue view
          const isQueueView = player.data.get('setupQueueView') === true;
          if (!player.queue.current) return interaction.deferUpdate().catch(() => {});
          const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
          const accentColor = await resolveAccentColor(player, artUrl);
          if (isQueueView) {
            // Switch back to art view
            player.data.set('setupQueueView', false);
            const payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            return interaction.update(payload);
          } else {
            // Switch to queue view — fetch recommendations asynchronously
            player.data.set('setupQueueView', true);
            player.data.set('setupQueuePage', 1);
            await interaction.deferUpdate();

            // Search for related songs based on current track
            let recommendations = [];
            try {
              const currentTrack = player.queue.current;
              const searchQuery = `ytmsearch:${[currentTrack.author, currentTrack.title].filter(Boolean).join(' ')}`;
              const recResult = await client.manager.search(searchQuery, { requester: currentTrack.requester, source: '' });
              if (recResult && recResult.tracks && recResult.tracks.length > 0) {
                // Filter out the current song (case-insensitive comparison), take up to 10
                const currentTitle = (currentTrack.title || '').toLowerCase().trim();
                const currentAuthor = (currentTrack.author || '').toLowerCase().trim();
                recommendations = recResult.tracks
                  .filter((t) => {
                    const tTitle = (t.title || '').toLowerCase().trim();
                    const tAuthor = (t.author || '').toLowerCase().trim();
                    return !(tTitle === currentTitle && tAuthor === currentAuthor);
                  })
                  .slice(0, 10);
              }
            } catch {
              // Recommendations are optional — non-fatal
            }
            player.data.set('setupRecommendations', recommendations);

            const tracks = [...player.queue];
            const payload = buildSetupQueueViewV2(player.queue.current, tracks, 1, accentColor, player, recommendations);
            return interaction.editReply(payload);
          }
        }

        if (customId === 'setup_shuffle') {
          await interaction.deferUpdate();
          const queueArr = [...player.queue];
          for (let i = queueArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queueArr[i], queueArr[j]] = [queueArr[j], queueArr[i]];
          }
          player.queue.splice(0, player.queue.length, ...queueArr);
          return;
        }

        if (customId === 'setup_vol_down') {
          const newVol = Math.max(0, (player.volume ?? 100) - 10);
          await player.setVolume(newVol).catch(() => {});
          // Update the ephemeral volume message if possible, otherwise defer
          try {
            await interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setTitle('🔊 Volume Control')
                  .setDescription(`Current volume: **${newVol}%**\nUse the buttons below to adjust.`)
                  .setFooter({ text: config.embeds.footerText }),
              ],
              components: interaction.message.components,
            });
          } catch {
            await interaction.deferUpdate().catch(() => {});
          }
          return;
        }

        if (customId === 'setup_vol_up') {
          const newVol = Math.min(200, (player.volume ?? 100) + 10);
          await player.setVolume(newVol).catch(() => {});
          try {
            await interaction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setTitle('🔊 Volume Control')
                  .setDescription(`Current volume: **${newVol}%**\nUse the buttons below to adjust.`)
                  .setFooter({ text: config.embeds.footerText }),
              ],
              components: interaction.message.components,
            });
          } catch {
            await interaction.deferUpdate().catch(() => {});
          }
          return;
        }

        return;
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
              // Use Kazagumo's getPrevious(true) to remove and return the most recent history entry.
              // Fall back to manual array shift for compatibility.
              let prevTrack;
              if (typeof player.getPrevious === 'function') {
                prevTrack = player.getPrevious(true);
              } else if (Array.isArray(player.queue.previous)) {
                prevTrack = player.queue.previous.shift();
              }

              if (prevTrack) {
                // replaceCurrent: false → current song is unshifted back to position 0
                // of the queue so it can still be played after the previous track
                await player.play(prevTrack, { replaceCurrent: false });
              }
            }
            break;
          }
          case 'player_pause': {
            await player.pause(!player.paused);
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
          const controlMsgId = player.data.get('controlMessageId');

          let payload;
          const isSetupMsg = setupInfo && interaction.message.id === setupInfo.messageId;
          const isControlMsg = controlMsgId && interaction.message.id === controlMsgId;

          if (isSetupMsg) {
            // Setup channel — respect current view mode
            const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
            const accentColor = await resolveAccentColor(player, artUrl);
            const isQueueView = player.data.get('setupQueueView') === true;
            if (isQueueView) {
              const tracks = [...player.queue];
              const qPage = player.data.get('setupQueuePage') || 1;
              const recommendations = player.data.get('setupRecommendations') || [];
              payload = buildSetupQueueViewV2(player.queue.current, tracks, qPage, accentColor, player, recommendations);
            } else {
              payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            }
          } else if (isControlMsg) {
            // Portable control panel — same style as !play
            payload = buildNowPlayingV2(player.queue.current, player, settings.largeArt);
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
