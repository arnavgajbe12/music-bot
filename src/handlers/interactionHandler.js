const { buildErrorEmbed } = require('../utils/embeds');
const { buildPlayerButtonsV2 } = require('../utils/componentBuilder');
const { getSettings } = require('../utils/setupManager');

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

      return;
    }

    // ── Button Interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId, guild, member } = interaction;

      const validIds = ['player_previous', 'player_pause', 'player_skip', 'player_stop', 'player_loop'];
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
            const prev = player.queue.previous;
            if (!prev) break;
            await player.play(prev, { replaceCurrent: true });
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
          case 'player_loop': {
            // Cycle: none → track → queue → none
            const current = player.loop || 'none';
            let newMode;
            if (current === 'none') newMode = 'track';
            else if (current === 'track') newMode = 'queue';
            else newMode = 'none';
            player.setLoop(newMode);
            break;
          }
        }

        // Update the button row on the now-playing message to reflect new state
        if (interaction.message?.editable && player.queue.current) {
          const settings = getSettings(guild.id);
          const { buildNowPlayingV2 } = require('../utils/componentBuilder');
          const payload = buildNowPlayingV2(player.queue.current, player, settings.largeArt);
          await interaction.message.edit(payload).catch(() => {});
        }
      } catch (error) {
        console.error('[InteractionHandler] Button error:', error);
      }
    }
  });
};
