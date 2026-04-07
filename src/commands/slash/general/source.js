/**
 * /source command
 * Lets server admins select the default Metadata Source (where the bot fetches
 * track info/images) and the Playback Source (where Lavalink actually streams audio).
 *
 * Two separate Component v2 StringSelectMenus are shown; their interactions are
 * handled in interactionHandler.js under 'source_metadata' and 'source_playback'.
 */

const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../../../../config');
const { getSettings } = require('../../../utils/setupManager');

// ── Metadata sources ──────────────────────────────────────────────────────────
// Where the bot fetches rich track info (title, artist, artwork) from.
const METADATA_SOURCES = [
  { label: 'YouTube Music', value: 'youtubemusic', emoji: config.emojis.platforms.youtubemusic, description: 'Fetch metadata from YouTube Music' },
  { label: 'YouTube', value: 'youtube', emoji: config.emojis.platforms.youtube, description: 'Fetch metadata from YouTube' },
  { label: 'Spotify', value: 'spotify', emoji: config.emojis.platforms.spotify, description: 'Fetch metadata from Spotify' },
  { label: 'Apple Music', value: 'applemusic', emoji: config.emojis.platforms.applemusic, description: 'Fetch metadata from Apple Music' },
  { label: 'SoundCloud', value: 'soundcloud', emoji: config.emojis.platforms.soundcloud, description: 'Fetch metadata from SoundCloud' },
  { label: 'JioSaavn', value: 'jiosaavn', emoji: config.emojis.platforms.jiosaavn, description: 'Fetch metadata from JioSaavn' },
];

// ── Playback sources ──────────────────────────────────────────────────────────
// Where Lavalink actually streams audio from. Only legally-streamable platforms
// that Lavalink supports are listed here.
const PLAYBACK_SOURCES = [
  { label: 'YouTube Music', value: 'ytmsearch:', emoji: config.emojis.platforms.youtubemusic, description: 'Stream audio via YouTube Music (default)' },
  { label: 'YouTube', value: 'ytsearch:', emoji: config.emojis.platforms.youtube, description: 'Stream audio via YouTube' },
  { label: 'SoundCloud', value: 'scsearch:', emoji: config.emojis.platforms.soundcloud, description: 'Stream audio via SoundCloud' },
];

/**
 * Build the Component v2 source-settings panel.
 * @param {string} currentMetadata - Current metadata source value
 * @param {string} currentPlayback  - Current playback source value (e.g. 'ytmsearch:')
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSourcePanel(currentMetadata, currentPlayback) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ⚙️ Source Settings\n` +
        `Configure where the bot fetches track information and where it streams audio from.\n\n` +
        `**Metadata Source** — where the bot looks up track info & artwork.\n` +
        `**Playback Source** — where Lavalink streams the audio (only legal platforms).`,
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  // Metadata source dropdown
  const metadataOptions = METADATA_SOURCES.map((src) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(src.label)
      .setValue(src.value)
      .setDescription(src.description)
      .setEmoji(src.emoji)
      .setDefault(src.value === currentMetadata),
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('source_metadata')
        .setPlaceholder('🔍 Select Metadata Source')
        .addOptions(metadataOptions),
    ),
  );

  // Playback source dropdown
  const playbackOptions = PLAYBACK_SOURCES.map((src) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(src.label)
      .setValue(src.value)
      .setDescription(src.description)
      .setEmoji(src.emoji)
      .setDefault(src.value === currentPlayback),
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('source_playback')
        .setPlaceholder('🎵 Select Playback Source')
        .addOptions(playbackOptions),
    ),
  );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('source')
    .setDescription('Set the default metadata and playback sources.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async run(client, interaction) {
    const settings = getSettings(interaction.guild.id);
    const panel = buildSourcePanel(
      settings.metadataSource || 'youtube',
      settings.playbackSource || 'ytmsearch:',
    );
    await interaction.reply({ ...panel, ephemeral: true });
  },

  // Exposed for use in interactionHandler
  buildSourcePanel,
  METADATA_SOURCES,
  PLAYBACK_SOURCES,
};
