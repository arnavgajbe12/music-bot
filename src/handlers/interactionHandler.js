const { buildErrorEmbed } = require('../utils/embeds');
const { buildPlayerButtons } = require('../utils/functions');

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
      }
      return;
    }

    // ── Button Interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId, guild, member } = interaction;

      if (!['player_previous', 'player_pause', 'player_skip', 'player_stop'].includes(customId)) return;

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
        }

        // Update the button row to reflect new state
        if (interaction.message?.editable) {
          const newRow = buildPlayerButtons(player);
          await interaction.message.edit({ components: [newRow] }).catch(() => {});
        }
      } catch (error) {
        console.error('[InteractionHandler] Button error:', error);
      }
    }
  });
};
