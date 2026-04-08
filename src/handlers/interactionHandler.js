const {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require('discord.js');
const { buildErrorEmbed, resolvePlatformEmoji, resolveSourceDisplayName, formatDuration } = require('../utils/embeds');
const {
  buildPlayerButtonsV2,
  buildQueueV2,
  buildQueueStandaloneV2,
  buildPlayNextConfirmV2,
  buildNowPlayingV2,
  buildSetupNowPlayingV2,
  buildSetupQueueViewV2,
  extractDominantColor,
} = require('../utils/componentBuilder');
const { getSettings, getSetup, updateSettings } = require('../utils/setupManager');
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

    // ── Modal Submissions ──────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'setup_vol_modal') {
        const player = client.manager.players.get(interaction.guild.id);
        if (!player) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }
        const raw = interaction.fields.getTextInputValue('vol_input');
        const vol = parseInt(raw, 10);
        if (isNaN(vol) || vol < 0 || vol > 200) {
          return interaction.reply({
            embeds: [buildErrorEmbed('Please enter a number between **0** and **200**.')],
            ephemeral: true,
          });
        }
        await player.setVolume(vol).catch(() => {});
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(config.embeds.color)
              .setDescription(`🔊 Volume set to **${vol}%**.`),
          ],
          ephemeral: true,
        });
        return;
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
                const accentColor = await resolveAccentColor(player, artUrl);
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

      // ── Setup Channel Controller dropdown ─────────────────────────────────
      if (interaction.customId === 'setup_controller') {
        const setupInfo = getSetup(interaction.guild.id);
        if (!setupInfo || interaction.message?.id !== setupInfo.messageId) {
          return interaction.reply({ embeds: [buildErrorEmbed('Setup panel not found.')], ephemeral: true });
        }

        const player = client.manager.players.get(interaction.guild.id);
        if (!player || !player.queue.current) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        // Require user to be in the same voice channel
        const vcCheck = interaction.member.voice?.channel;
        if (!vcCheck || vcCheck.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        const selected = interaction.values[0];

        switch (selected) {
          case 'controller_volume': {
            await interaction.deferUpdate();
            const currentVol = player.volume ?? 100;
            const volContainer = new ContainerBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`🔊 **Volume** — Current: **${currentVol}%**\nUse the buttons below to adjust, or enter a specific value.`),
              )
              .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId('setup_vol_ephemeral_up')
                    .setEmoji('⬆️')
                    .setLabel('+10%')
                    .setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder()
                    .setCustomId('setup_vol_ephemeral_down')
                    .setEmoji('⬇️')
                    .setLabel('-10%')
                    .setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder()
                    .setCustomId('setup_vol_ephemeral_manual')
                    .setEmoji('🔧')
                    .setLabel('Manual')
                    .setStyle(ButtonStyle.Primary),
                ),
              );
            await interaction.followUp({ components: [volContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            break;
          }

          case 'controller_loop_track': {
            const newMode = player.loop === 'track' ? 'none' : 'track';
            player.setLoop(newMode);
            const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
            const accentColor = await resolveAccentColor(player, artUrl);
            const isQueueView = player.data.get('setupQueueView') === true;
            let payload;
            if (isQueueView) {
              const tracks = [...player.queue];
              const qPage = player.data.get('setupQueuePage') || 1;
              payload = buildSetupQueueViewV2(player.queue.current, tracks, qPage, accentColor, player);
            } else {
              payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            }
            await interaction.update(payload);
            break;
          }

          case 'controller_loop_queue': {
            const newMode = player.loop === 'queue' ? 'none' : 'queue';
            player.setLoop(newMode);
            const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
            const accentColor = await resolveAccentColor(player, artUrl);
            const isQueueView = player.data.get('setupQueueView') === true;
            let payload;
            if (isQueueView) {
              const tracks = [...player.queue];
              const qPage = player.data.get('setupQueuePage') || 1;
              payload = buildSetupQueueViewV2(player.queue.current, tracks, qPage, accentColor, player);
            } else {
              payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            }
            await interaction.update(payload);
            break;
          }

          case 'controller_clear_queue': {
            player.queue.clear();
            await interaction.deferUpdate();
            await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setDescription('🗑️ Queue cleared.'),
              ],
              ephemeral: true,
            });
            break;
          }

          case 'controller_disconnect': {
            player.queue.clear();
            await player.skip().catch(() => {});
            await interaction.deferUpdate();
            await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.embeds.color)
                  .setDescription('👋 Disconnected from the voice channel.'),
              ],
              ephemeral: true,
            });
            break;
          }

          default:
            await interaction.reply({ embeds: [buildErrorEmbed('Unknown controller option.')], ephemeral: true });
        }
        return;
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
        if (!setupInfo || interaction.message.id !== setupInfo.messageId) return interaction.deferUpdate().catch(() => {});

        const player = client.manager.players.get(guild.id);
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

      // ── Setup channel buttons (Queue, Shuffle, Settings + ephemeral vol) ──────
      const setupButtonIds = ['setup_queue', 'setup_shuffle', 'setup_settings',
        'setup_vol_ephemeral_up', 'setup_vol_ephemeral_down', 'setup_vol_ephemeral_manual'];
      if (setupButtonIds.includes(customId)) {
        const player = client.manager.players.get(guild.id);
        if (!player) {
          return interaction.reply({ embeds: [buildErrorEmbed('There is no active player.')], ephemeral: true });
        }

        // Ephemeral volume buttons do NOT require being on the setup panel message
        const isEphemeralVol = customId.startsWith('setup_vol_ephemeral_');

        if (!isEphemeralVol) {
          const setupInfo = getSetup(guild.id);
          if (!setupInfo || interaction.message.id !== setupInfo.messageId) {
            return interaction.reply({ embeds: [buildErrorEmbed('Setup panel not found.')], ephemeral: true });
          }
        }

        // Require user to be in the same voice channel
        const voiceChannel = member.voice?.channel;
        if (!voiceChannel || voiceChannel.id !== player.voiceId) {
          return interaction.reply({
            embeds: [buildErrorEmbed('You must be in the same voice channel as the bot to use controls.')],
            ephemeral: true,
          });
        }

        // ── 📋 Queue toggle ──────────────────────────────────────────────────
        if (customId === 'setup_queue') {
          const isQueueView = player.data.get('setupQueueView') === true;
          if (!player.queue.current) return interaction.deferUpdate().catch(() => {});
          const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
          const accentColor = await resolveAccentColor(player, artUrl);
          if (isQueueView) {
            player.data.set('setupQueueView', false);
            const payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            return interaction.update(payload);
          } else {
            player.data.set('setupQueueView', true);
            player.data.set('setupQueuePage', 1);
            const tracks = [...player.queue];
            const payload = buildSetupQueueViewV2(player.queue.current, tracks, 1, accentColor, player);
            return interaction.update(payload);
          }
        }

        // ── 🔀 Shuffle toggle ────────────────────────────────────────────────
        if (customId === 'setup_shuffle') {
          const isShuffled = player.data.get('shuffleMode') === true;
          if (!isShuffled) {
            // Enable: shuffle the current queue and mark mode ON
            const queueArr = [...player.queue];
            for (let i = queueArr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [queueArr[i], queueArr[j]] = [queueArr[j], queueArr[i]];
            }
            player.queue.splice(0, player.queue.length, ...queueArr);
            player.data.set('shuffleMode', true);
          } else {
            // Disable shuffle mode
            player.data.set('shuffleMode', false);
          }
          // Refresh panel to show updated button color
          if (!player.queue.current) return interaction.deferUpdate().catch(() => {});
          const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
          const accentColor = await resolveAccentColor(player, artUrl);
          const isQueueView = player.data.get('setupQueueView') === true;
          let payload;
          if (isQueueView) {
            const tracks = [...player.queue];
            const qPage = player.data.get('setupQueuePage') || 1;
            payload = buildSetupQueueViewV2(player.queue.current, tracks, qPage, accentColor, player);
          } else {
            payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
          }
          return interaction.update(payload);
        }

        // ── ⚙️ Settings (ephemeral placeholder) ──────────────────────────────
        if (customId === 'setup_settings') {
          await interaction.deferUpdate();
          const settings = getSettings(guild.id);
          const settingsContainer = new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `⚙️ **Settings**\nConfigure bot behaviour for this server.\n\n` +
                `🔄 **Autoplay** — Auto-queue a related track when the queue ends.\n` +
                `🕐 **24/7 Mode** — Keep the bot in the voice channel even when idle.`,
              ),
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('settings_autoplay_on')
                  .setLabel('Autoplay ON')
                  .setEmoji('🔄')
                  .setStyle(settings.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('settings_autoplay_off')
                  .setLabel('Autoplay OFF')
                  .setEmoji('⏹️')
                  .setStyle(!settings.autoplay ? ButtonStyle.Danger : ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('settings_247_on')
                  .setLabel('24/7 ON')
                  .setEmoji('🕐')
                  .setStyle(settings.mode247 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                  .setCustomId('settings_247_off')
                  .setLabel('24/7 OFF')
                  .setEmoji('⏹️')
                  .setStyle(!settings.mode247 ? ButtonStyle.Danger : ButtonStyle.Secondary),
              ),
            );
          await interaction.followUp({ components: [settingsContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
          return;
        }

        // ── Ephemeral Volume buttons ─────────────────────────────────────────
        if (customId === 'setup_vol_ephemeral_up') {
          const newVol = Math.min(200, (player.volume ?? 100) + 10);
          await player.setVolume(newVol).catch(() => {});
          await interaction.deferUpdate();
          return;
        }

        if (customId === 'setup_vol_ephemeral_down') {
          const newVol = Math.max(0, (player.volume ?? 100) - 10);
          await player.setVolume(newVol).catch(() => {});
          await interaction.deferUpdate();
          return;
        }

        if (customId === 'setup_vol_ephemeral_manual') {
          const modal = new ModalBuilder()
            .setCustomId('setup_vol_modal')
            .setTitle('Set Volume');
          const volInput = new TextInputBuilder()
            .setCustomId('vol_input')
            .setLabel('Volume (0 – 200)')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(3)
            .setPlaceholder('e.g. 80')
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(volInput));
          await interaction.showModal(modal);
          return;
        }

        return;
      }

      // ── Settings toggle buttons (from ephemeral settings panel) ─────────────
      const settingsButtonIds = ['settings_autoplay_on', 'settings_autoplay_off', 'settings_247_on', 'settings_247_off'];
      if (settingsButtonIds.includes(customId)) {
        const guildId = guild.id;
        if (customId === 'settings_autoplay_on') updateSettings(guildId, { autoplay: true });
        else if (customId === 'settings_autoplay_off') updateSettings(guildId, { autoplay: false });
        else if (customId === 'settings_247_on') updateSettings(guildId, { mode247: true });
        else if (customId === 'settings_247_off') updateSettings(guildId, { mode247: false });
        await interaction.deferUpdate();
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

          let payload;
          if (setupInfo && interaction.message.id === setupInfo.messageId) {
            // Setup channel panel — respect current view mode
            const artUrl = player.queue.current.thumbnail || player.queue.current.artworkUrl || null;
            const accentColor = await resolveAccentColor(player, artUrl);
            const isQueueView = player.data.get('setupQueueView') === true;
            if (isQueueView) {
              const tracks = [...player.queue];
              const qPage = player.data.get('setupQueuePage') || 1;
              payload = buildSetupQueueViewV2(player.queue.current, tracks, qPage, accentColor, player);
            } else {
              payload = buildSetupNowPlayingV2(player.queue.current, player, accentColor);
            }
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
