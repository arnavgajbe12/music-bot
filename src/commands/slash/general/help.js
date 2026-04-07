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
    ],
  },
  platform: {
    label: 'Platform Search',
    emoji: '🔍',
    description: 'Force search on a specific streaming platform',
    commands: [
      { name: 'yt', desc: 'Search and play from YouTube', usage: '!yt <query>' },
      { name: 'ytm', desc: 'Search and play from YouTube Music', usage: '!ytm <query>' },
      { name: 'sp', desc: 'Search and play from Spotify', usage: '!sp <query>' },
      { name: 'ap', desc: 'Search and play from Apple Music', usage: '!ap <query>' },
      { name: 'sc', desc: 'Search and play from SoundCloud', usage: '!sc <query>' },
      { name: 'dz', desc: 'Search and play from Deezer', usage: '!dz <query>' },
      { name: 'az', desc: 'Search and play from Amazon Music', usage: '!az <query>' },
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
    ],
  },
};

function buildCategoryEmbed(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return null;

  const fields = cat.commands.map((cmd) => ({
    name: `\`${cmd.usage}\``,
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
    const embed = buildCategoryEmbed(category);
    const row = buildSelectMenu(category);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  // Exposed so the interaction handler can call it when the select menu fires
  buildCategoryEmbed,
  buildSelectMenu,
};
