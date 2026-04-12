const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const config = require('../../../../config');

const CATEGORIES = {
  music: {
    label: 'Music',
    emoji: config.emojis.music,
    description: 'Commands for controlling music playback',
    commands: [
      { name: 'play', desc: 'Play a song or add it to the queue', usage: '!play <query>' },
      { name: 'pause', desc: 'Pause or resume the current track', usage: '!pause' },
      { name: 'skip', desc: 'Skip the current track', usage: '!skip' },
      { name: 'stop', desc: 'Stop music and clear the queue', usage: '!stop' },
      { name: 'queue', desc: 'View the current queue', usage: '!queue [page]' },
      { name: 'nowplaying', desc: 'Show the currently playing track', usage: '!nowplaying' },
      { name: 'volume', desc: 'Adjust the player volume', usage: '!volume <1-200>' },
      { name: 'loop', desc: 'Toggle track/queue loop mode', usage: '!loop [track|queue|off]' },
      { name: 'shuffle', desc: 'Shuffle the queue', usage: '!shuffle' },
      { name: 'clear', desc: 'Clear the queue', usage: '!clear' },
      { name: 'remove', desc: 'Remove a track from the queue', usage: '!remove <position>' },
      { name: 'autoplay', desc: 'Toggle autoplay of related tracks', usage: '!autoplay' },
      { name: 'playnext', desc: 'Add a song to play next in the queue', usage: '!playnext <query>' },
      { name: 'disconnect', desc: 'Disconnect the bot from the voice channel', usage: '!disconnect' },
    ],
  },
  platform: {
    label: 'Platform Search',
    emoji: '🔍',
    description: 'Force search on a specific streaming platform',
    commands: [
      { name: 'yt', desc: 'Search and play from YouTube', usage: '!yt <query>' },
      { name: 'ytm', desc: 'Search and play from YouTube Music', usage: '!ytm <query>' },
      { name: 'ap', desc: 'Search and play from Apple Music', usage: '!ap <query>' },
    ],
  },
  setup: {
    label: 'Setup',
    emoji: '⚙️',
    description: 'Configure the Song Request channel panel',
    commands: [
      { name: 'setup', desc: 'Set a dedicated song request channel with a permanent control panel', usage: '!setup <#channel>' },
      { name: 'setup remove', desc: 'Remove the song request channel setup', usage: '!setup remove' },
      { name: 'largeart', desc: 'Toggle large banner art vs small thumbnail art', usage: '!largeart <on|off>' },
      { name: 'source', desc: 'Set the default metadata and playback source platforms', usage: '!source' },
      { name: '/prefix set', desc: 'Set (overwrite) the server command prefix (Admin only)', usage: '/prefix set <prefix>' },
      { name: '/prefix add', desc: 'Add an additional server prefix (Admin only)', usage: '/prefix add <prefix>' },
      { name: '/prefix remove', desc: 'Remove a server prefix (Admin only)', usage: '/prefix remove <prefix>' },
      { name: '/prefix list', desc: 'Show all active server prefixes', usage: '/prefix list' },
    ],
  },
  dj: {
    label: 'DJ',
    emoji: '🎧',
    description: 'DJ & advanced player controls',
    commands: [
      { name: '247', desc: 'Toggle 24/7 mode (bot stays in VC)', usage: '!247' },
      { name: 'autoplay', desc: 'Toggle autoplay of related tracks', usage: '!autoplay' },
      { name: 'vcstatus', desc: 'Set or clear the voice channel status', usage: '!vcstatus [text]' },
      { name: 'nodes', desc: 'Show Lavalink node statistics', usage: '!nodes' },
    ],
  },
  general: {
    label: 'General',
    emoji: '🤖',
    description: 'General bot commands',
    commands: [
      { name: 'help', desc: 'Show this help menu', usage: '!help [category]' },
      { name: 'ping', desc: "Check the bot's latency", usage: '!ping' },
      { name: 'noprefix', desc: 'Toggle your no-prefix access on/off (if granted)', usage: '!noprefix enable|disable' },
    ],
  },
};

/**
 * Build the category embed.
 * @param {string} categoryKey
 * @param {string} [guildPrefix] - Optional guild-specific prefix to display instead of '!'
 */
function buildCategoryEmbed(categoryKey, guildPrefix) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return null;
  const displayPrefix = guildPrefix || '!';

  const fields = cat.commands.map((cmd) => ({
    name: `\`${cmd.usage.replace(/^!/, displayPrefix)}\``,
    value: cmd.desc,
    inline: false,
  }));

  return new EmbedBuilder()
    .setColor(config.embeds.color)
    .setAuthor({ name: `${cat.emoji} ${cat.label} Commands` })
    .setDescription(`${cat.description}\n\n> **Tip:** All commands also work as slash commands. Type \`/\` in chat to see them.`)
    .addFields(fields)
    .setFooter({ text: `${config.embeds.footerText} • Use the dropdown below to switch categories` })
    .setTimestamp();
}

function buildSelectMenu(selectedCategory) {
  const options = Object.entries(CATEGORIES).map(([key, cat]) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(cat.label)
      .setEmoji(cat.emoji)
      .setDescription(cat.description)
      .setValue(key)
      .setDefault(key === selectedCategory),
  );

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Select a category')
      .addOptions(options),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all available commands by category.')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Jump straight to a category')
        .setRequired(false)
        .addChoices(
          { name: 'Music', value: 'music' },
          { name: 'Platform Search', value: 'platform' },
          { name: 'Setup', value: 'setup' },
          { name: 'DJ', value: 'dj' },
          { name: 'General', value: 'general' },
        ),
    ),

  async run(client, interaction) {
    const category = interaction.options.getString('category') || 'music';
    const { getPrefixes } = require('../../../utils/setupManager');
    const prefixes = getPrefixes(interaction.guild?.id || '');
    const displayPrefix = prefixes[0] || '!';
    const embed = buildCategoryEmbed(category, displayPrefix);
    const row = buildSelectMenu(category);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  // Exposed so the interaction handler can call it when the select menu fires
  buildCategoryEmbed,
  buildSelectMenu,
};
