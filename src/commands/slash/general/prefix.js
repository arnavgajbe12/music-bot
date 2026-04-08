/**
 * /prefix — View and manage server prefixes via slash command.
 * Server Admins only (for management). Anyone can view.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { buildErrorEmbed, buildEmbed } = require('../../../utils/embeds');
const { getPrefixes, setPrefixes, addPrefix, removePrefix } = require('../../../utils/setupManager');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('View or manage server command prefixes.')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show all active prefixes for this server.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Overwrite the server prefix (Admin only).')
        .addStringOption((opt) =>
          opt.setName('prefix').setDescription('The new prefix (max 5 chars)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add an additional prefix (Admin only).')
        .addStringOption((opt) =>
          opt.setName('prefix').setDescription('Prefix to add (max 5 chars)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a prefix (Admin only).')
        .addStringOption((opt) =>
          opt.setName('prefix').setDescription('Prefix to remove').setRequired(true),
        ),
    ),

  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (sub === 'list') {
      const prefixes = getPrefixes(interaction.guild.id);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.embeds.color)
            .setTitle('📋 Active Prefixes')
            .setDescription(prefixes.map((p) => `\`${p}\``).join('\n'))
            .setFooter({ text: config.embeds.footerText }),
        ],
        ephemeral: true,
      });
    }

    if (!isAdmin) {
      return interaction.reply({ embeds: [buildErrorEmbed('You need Administrator permission to manage prefixes.')], ephemeral: true });
    }

    if (sub === 'set') {
      const prefix = interaction.options.getString('prefix');
      if (prefix.length > 5) {
        return interaction.reply({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')], ephemeral: true });
      }
      setPrefixes(interaction.guild.id, [prefix]);
      return interaction.reply({ embeds: [buildEmbed(`✅ Server prefix set to \`${prefix}\`.`)], ephemeral: true });
    }

    if (sub === 'add') {
      const prefix = interaction.options.getString('prefix');
      if (prefix.length > 5) {
        return interaction.reply({ embeds: [buildErrorEmbed('Prefix must be 5 characters or fewer.')], ephemeral: true });
      }
      const current = getPrefixes(interaction.guild.id);
      if (current.includes(prefix)) {
        return interaction.reply({ embeds: [buildErrorEmbed(`\`${prefix}\` is already an active prefix.`)], ephemeral: true });
      }
      addPrefix(interaction.guild.id, prefix);
      const updated = getPrefixes(interaction.guild.id);
      return interaction.reply({
        embeds: [buildEmbed(`✅ Added \`${prefix}\`. Active prefixes: ${updated.map((p) => `\`${p}\``).join(', ')}`)],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const prefix = interaction.options.getString('prefix');
      const current = getPrefixes(interaction.guild.id);
      if (current.length === 1 && current[0] === prefix) {
        return interaction.reply({ embeds: [buildErrorEmbed('Cannot remove the last remaining prefix.')], ephemeral: true });
      }
      const removed = removePrefix(interaction.guild.id, prefix);
      if (!removed) {
        return interaction.reply({ embeds: [buildErrorEmbed(`\`${prefix}\` is not an active prefix.`)], ephemeral: true });
      }
      const updated = getPrefixes(interaction.guild.id);
      return interaction.reply({
        embeds: [buildEmbed(`✅ Removed \`${prefix}\`. Active prefixes: ${updated.map((p) => `\`${p}\``).join(', ')}`)],
        ephemeral: true,
      });
    }
  },
};
