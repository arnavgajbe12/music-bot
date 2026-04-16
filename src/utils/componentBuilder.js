/**
 * componentBuilder.js
 * Builds Component v2 messages for the Now Playing panel.
 * Requires MessageFlags.IsComponentsV2 (32768) on every message.
 */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const Vibrant = require('node-vibrant');
const config = require('../../config');
const { formatDuration, resolvePlatformEmoji, resolveSourceDisplayName } = require('./embeds');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum length of a Discord select-menu option label/description. */
const SELECT_OPTION_MAX_LENGTH = 100;

/** Auto-delete delay (ms) for ephemeral "play next" confirmation messages. */
const PLAY_NEXT_DELETE_DELAY_MS = 15000;

// ─── Color Extraction ─────────────────────────────────────────────────────────

/**
 * Extract the dominant accent color from a thumbnail URL using node-vibrant.
 * Falls back to a random vivid HEX color on any failure.
 * @param {string} imageUrl - URL of the track thumbnail
 * @returns {Promise<number>} Integer color suitable for setAccentColor / setColor
 */
async function extractDominantColor(imageUrl) {
  try {
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) throw new Error('invalid url');
    const palette = await Vibrant.from(imageUrl).getPalette();
    const swatch =
      palette.Vibrant ||
      palette.LightVibrant ||
      palette.DarkVibrant ||
      palette.Muted ||
      palette.LightMuted ||
      palette.DarkMuted;
    if (swatch) {
      const [r, g, b] = swatch.getRgb();
      return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    }
  } catch {
    // Fall through to random color
  }
  // Random vivid color as fallback
  return Math.floor(Math.random() * 0xffffff);
}

// ─── Button Builders ──────────────────────────────────────────────────────────

/**
 * Build the music player control row (without loop button — loop is in the dropdown).
 * @param {object} player - KazagumoPlayer
 * @returns {ActionRowBuilder}
 */
function buildPlayerButtonsV2(player) {
  const hasPrevious = Array.isArray(player.queue.previous)
    ? player.queue.previous.length > 0
    : player.queue.previous != null;
  const isPaused = player.paused;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrevious),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(isPaused ? config.emojis.play : config.emojis.pause)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Build fully-disabled button row (for queue concluded / idle state).
 * @returns {ActionRowBuilder}
 */
function buildDisabledButtonsV2() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(config.emojis.play)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );
}

/**
 * Build the "More Options" dropdown (replaces the old Loop button).
 * @returns {ActionRowBuilder}
 */
function buildMoreOptionsDropdown() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('player_more_options')
      .setPlaceholder('⚙️ More Options')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Loop Mode')
          .setEmoji('🔁')
          .setDescription('Toggle between Track, Queue, and Off')
          .setValue('loop_toggle'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Song Info')
          .setEmoji('ℹ️')
          .setDescription('Show detailed track info and a link')
          .setValue('song_info'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Shuffle')
          .setEmoji('🔀')
          .setDescription('Shuffle the current queue')
          .setValue('shuffle_queue'),
        new StringSelectMenuOptionBuilder()
          .setLabel('View Queue')
          .setEmoji('📜')
          .setDescription('Show the upcoming queue')
          .setValue('view_queue'),
      ]),
  );
}

// ─── Component v2 Panel Builders ──────────────────────────────────────────────

/**
 * Determine whether to show a track's thumbnail as 1:1 (square) or 16:9 (wide).
 * Only explicit YouTube searches (!yt / /yt) use 16:9; everything else uses 1:1.
 * Tracks searched via yt commands have `track.useWide = true` set on the track.
 * @param {object} track - KazagumoTrack
 * @returns {'square'|'wide'}
 */
function getThumbnailDisplayMode(track) {
  if (track?.useWide === true) return 'wide';
  // YouTube Music always uses square album art — never force wide
  if (track?.sourceName === 'youtubemusic') return 'square';
  return 'square';
}

/**
 * Build the Now Playing Component v2 message payload.
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {boolean} [largeArt=true] - Show art as large gallery image
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildNowPlayingV2(track, player, largeArt = true) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const requester = track.requester;
  const requesterName = requester
    ? requester.displayName || requester.username || requester.tag || 'Unknown'
    : 'Unknown';
  const isWide = getThumbnailDisplayMode(track) === 'wide';
  // Prefer artworkUrl (1:1 album art) over thumbnail (16:9 video) for non-yt tracks
  const rawArtUrl = isWide
    ? (track.thumbnail || track.artworkUrl || config.images.defaultThumbnail)
    : (track.artworkUrl || track.thumbnail || config.images.defaultThumbnail);
  const artUrl = isWide ? rawArtUrl : getSquareThumbnailUrl(rawArtUrl);

  const isPaused = player.paused;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';

  // Top header: "<emoji> Now Playing - [Title](url)"
  const titleLink = track.uri ? `[${track.title}](${track.uri})` : track.title;
  const statusText = isPaused
    ? `${platformEmoji} **Paused** - ${titleLink}${loopMode}`
    : `${platformEmoji} **Now Playing** - ${titleLink}${loopMode}`;

  const container = new ContainerBuilder();

  // Apply dynamic accent color if available (left color stripe)
  const accentColor = player.data?.get('accentColor');
  if (accentColor != null) container.setAccentColor(accentColor);

  // Header with title hyperlink
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(statusText),
  );

  // Detail text (artist, source, duration, requester — title shown separately below image)
  const detailText =
    `🎤  ${track.author || 'Unknown'}\n` +
    `${platformEmoji}: ${sourceDisplay}\n` +
    `⏱️  ${formatDuration(track.length)}\n` +
    `👤  ${requesterName}`;

  if (largeArt) {
    // Large gallery image for all track types (as required)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
    );
    // Large song title (## heading) below the image, no link
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${track.title}`),
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));
  } else {
    // Small thumbnail in a section accessory
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));
    container.addSectionComponents(section);
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildPlayerButtonsV2(player));
  container.addActionRowComponents(buildMoreOptionsDropdown());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build the Queue Concluded / Idle Component v2 message payload.
 * @param {string} [artUrl] - Optional default image URL
 * @param {boolean} [largeArt=true]
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildIdleV2(artUrl, largeArt = true) {
  const imageUrl = artUrl || config.images.defaultThumbnail;
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${config.emojis.stop} **Queue Concluded**`),
  );

  if (largeArt) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('All tracks have been played.\nUse `!play` or `/play` to add more music!'),
    );
  } else {
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'All tracks have been played.\nUse `!play` or `/play` to add more music!',
        ),
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));
    container.addSectionComponents(section);
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildDisabledButtonsV2());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ─── Setup Channel Builders ───────────────────────────────────────────────────

/**
 * Build the Setup Channel 4-button control row.
 * All buttons are the same style (Secondary/Grey), except Pause toggles to
 * Success (green) when the player is paused and Stop is always Danger (red).
 * @param {object} player - KazagumoPlayer
 * @returns {ActionRowBuilder}
 */
function buildSetupButtonsV2(player) {
  const hasPrevious = Array.isArray(player.queue.previous)
    ? player.queue.previous.length > 0
    : player.queue.previous != null;
  const isPaused = player.paused;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrevious),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(isPaused ? config.emojis.play : config.emojis.pause)
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Build the Setup Channel disabled button row (for idle state).
 * @returns {ActionRowBuilder}
 */
function buildSetupDisabledButtonsV2() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('player_previous')
      .setEmoji(config.emojis.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setEmoji(config.emojis.play)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setEmoji(config.emojis.skip)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setEmoji(config.emojis.stop)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );
}

/**
 * Build Row 2 of the Setup Channel controls:
 * Queue (🎛️ Queue), Shuffle (🔀 Shuffle) — both with text labels.
 * When isQueueView is true, the Queue button is highlighted green.
 * @param {boolean} [isQueueView=false]
 * @returns {ActionRowBuilder}
 */
function buildSetupRow2V2(isQueueView = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_queue')
      .setEmoji('🎛️')
      .setLabel('Queue')
      .setStyle(isQueueView ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_shuffle')
      .setEmoji(config.emojis.shuffle)
      .setLabel('Shuffle')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build Row 2 of the Setup Channel controls in disabled state (for idle panel).
 * @returns {ActionRowBuilder}
 */
function buildSetupRow2DisabledV2() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_queue')
      .setEmoji('🎛️')
      .setLabel('Queue')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('setup_shuffle')
      .setEmoji(config.emojis.shuffle)
      .setLabel('Shuffle')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

/**
 * Build Row 3 of the Setup Channel: Controls dropdown.
 * Options: Loop Track, Loop Queue, Volume (hidden embed), Disconnect.
 * @returns {ActionRowBuilder}
 */
function buildSetupControlsDropdownV2() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup_controls')
      .setPlaceholder('⚙️ Controls')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Loop Track')
          .setEmoji('🔂')
          .setDescription('Toggle track loop on/off')
          .setValue('loop_track'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Loop Queue')
          .setEmoji('🔁')
          .setDescription('Toggle queue loop on/off')
          .setValue('loop_queue'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Volume')
          .setEmoji('🔊')
          .setDescription('Show and adjust current volume')
          .setValue('volume_info'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Disconnect')
          .setEmoji('👋')
          .setDescription('Disconnect the bot from the voice channel')
          .setValue('disconnect'),
      ]),
  );
}

/**
 * Build Row 3 disabled Controls dropdown (for idle panel).
 * @returns {ActionRowBuilder}
 */
function buildSetupControlsDropdownDisabledV2() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('setup_controls')
      .setPlaceholder('⚙️ Controls')
      .setDisabled(true)
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Controls')
          .setValue('disabled'),
      ]),
  );
}

// ─── Square Thumbnail Helper ────────────────────────────────────────────────────

/**
 * Attempt to return a 1:1 square thumbnail URL.
 * - For YouTube Music thumbnails (lh3.googleusercontent.com): appends the
 *   =w500-h500-l90-rj resize parameter so the CDN returns a 500×500 square crop.
 * - For YouTube video thumbnails (i.ytimg.com / img.youtube.com): normalizes to
 *   hqdefault.jpg then routes through wsrv.nl to force a 500×500 center crop.
 * - All other URLs are returned unchanged.
 * @param {string} url - Original thumbnail URL
 * @returns {string} Possibly-modified URL
 */
function getSquareThumbnailUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);

    // Google image-serving CDN (YTM / Spotify) — true 500×500 square
    if (parsed.hostname === 'lh3.googleusercontent.com') {
      return url.replace(/=[^&?]*$/, '') + '=w500-h500-l90-rj';
    }

    // YouTube video thumbnails — proxy-crop to 500×500 square
    if (parsed.hostname === 'i.ytimg.com' || parsed.hostname === 'img.youtube.com') {
      // First normalize to hqdefault to avoid 404s on maxresdefault
      const normalized = url.replace(
        /\/(maxresdefault|mqdefault|sddefault|hqdefault|default)(\.jpg|\.webp)?(\?.*)?$/,
        '/hqdefault.jpg',
      );
      // Use wsrv.nl free image proxy to force a 500×500 square crop
      return `https://wsrv.nl/?url=${encodeURIComponent(normalized)}&w=500&h=500&fit=cover&output=jpg`;
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return url;
}

/**
 * Build the Setup Channel Now Playing Component v2 panel.
 *
 * Layout:
 *  - Dynamic accent color (extracted from thumbnail, random on failure)
 *  - TextDisplay: 🎵 Now Playing + -# [Song Title hyperlink]  (header)
 *  - Thumbnail: 1:1 square for YouTube Music, 16:9 gallery for others
 *  - ### ♪  [Song Title]
 *  - [Artist]
 *  - -# [Total Length]  (or -# [Progress] / [Total Length] when paused)
 *  - Separator
 *  - Row 1: Prev | Pause | Skip | Stop
 *  - Row 2: Queue (with text) | Shuffle (with text)
 *  - Row 3: Controls dropdown (Loop Track, Loop Queue, Volume, Disconnect)
 *
 * @param {object} track  - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {number} [accentColor] - Pre-computed accent color (integer).
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupNowPlayingV2(track, player, accentColor) {
  const isWide = getThumbnailDisplayMode(track) === 'wide';
  // For wide (yt) tracks prefer thumbnail (16:9); for all others prefer artworkUrl (1:1)
  const rawArtUrl = isWide
    ? (track.thumbnail || track.artworkUrl || config.images.defaultThumbnail)
    : (track.artworkUrl || track.thumbnail || config.images.defaultThumbnail);
  const artUrl = isWide ? rawArtUrl : getSquareThumbnailUrl(rawArtUrl);

  const container = new ContainerBuilder();

  // Apply accent color (left color stripe)
  const color = accentColor != null ? accentColor : Math.floor(Math.random() * 0xffffff);
  container.setAccentColor(color);

  // ── Row 1: <Source emoji> Now Playing - Sr.No. • [Song Title](url) ──────────
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const titleLink = track.uri ? `[${track.title}](${track.uri})` : track.title;
  const absIdx = player.data?.get('absoluteQueueIndex') ?? 1;
  const headerLine = `${platformEmoji} Now Playing - ${absIdx} • ${titleLink}`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerLine),
  );

  // ── Row 2: •(@Requested User) and optional Playlist info ─────────────────────
  const requester = track.requester;
  const requesterId = requester?.id;
  const requesterStr = requesterId ? `•(<@${requesterId}>)` : '';
  const playlistName = track.playlistName || player.data?.get('currentPlaylistName') || null;
  const playlistUrl = track.playlistUrl || player.data?.get('currentPlaylistUrl') || null;
  let row2 = requesterStr;
  if (playlistName) {
    const playlistLink = playlistUrl ? `[${playlistName}](${playlistUrl})` : playlistName;
    row2 += `\nPlaylist: ${playlistLink}`;
  }
  if (row2) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(row2),
    );
  }

  // ── Thumbnail + track details ─────────────────────────────────────────────────
  const artist = track.author || 'Unknown Artist';
  const totalDuration = formatDuration(track.length);
  let durationLine;
  if (player.paused && player.position > 0) {
    const progress = formatDuration(player.position);
    durationLine = `-# ${progress} / ${totalDuration}`;
  } else {
    durationLine = `-# ${totalDuration}`;
  }

  // Large gallery image for all track types (as required — large image everywhere)
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
  );
  // Large text title (## heading) below the image
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${track.title}`),
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${artist}\n${durationLine}`),
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildSetupButtonsV2(player));
  container.addActionRowComponents(buildSetupRow2V2(false));
  container.addActionRowComponents(buildSetupControlsDropdownV2());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build the Setup Channel idle/waiting panel (no track playing).
 * Shown when the bot is not playing anything in a guild with a setup channel.
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupIdleV2() {
  const imageUrl = config.images.defaultThumbnail;
  const container = new ContainerBuilder();

  container.setAccentColor(config.embeds.color);

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)),
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Waiting for music...'),
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('Use `!play` or `/play` to start playing a song.'),
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildSetupDisabledButtonsV2());
  container.addActionRowComponents(buildSetupRow2DisabledV2());
  container.addActionRowComponents(buildSetupControlsDropdownDisabledV2());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ─── Setup Channel Queue Toggle View ──────────────────────────────────────────

/** Number of upcoming tracks shown per page in the setup channel queue view. */
const SETUP_QUEUE_PAGE_SIZE = 4;

/**
 * Build the Setup Channel Queue Toggle View.
 * Shows current + upcoming tracks. The currently playing track uses the big
 * header format; upcoming tracks use the compact format with absolute indices.
 *
 * Current track format:
 *   QUEUE・N songs
 *   ### 🎵  Title
 *   Artist
 *   -# duration (or -# elapsed / total when paused)
 *   -# `absIdx`・@requester
 *
 * Upcoming track format (each separated by a Separator):
 *   **Title** - Artist
 *   -# `absIdx`・@requester
 *
 * @param {object} currentTrack     - KazagumoTrack (currently playing)
 * @param {object[]} tracks         - Upcoming tracks array
 * @param {number} page             - Current page (1-based)
 * @param {number} accentColor      - Pre-computed accent color (integer)
 * @param {object} player           - KazagumoPlayer (for control buttons state)
 * @param {object[]} [recommendations] - Optional array of recommended KazagumoTracks (max 10)
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupQueueViewV2(currentTrack, tracks, page = 1, accentColor, player, recommendations) {
  const totalPages = Math.max(1, Math.ceil(tracks.length / SETUP_QUEUE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * SETUP_QUEUE_PAGE_SIZE;
  const pageTracks = tracks.slice(start, start + SETUP_QUEUE_PAGE_SIZE);

  const container = new ContainerBuilder();
  const color = accentColor != null ? accentColor : Math.floor(Math.random() * 0xffffff);
  container.setAccentColor(color);

  // Navigation row at the TOP — includes prev/next page buttons and a jump-to-last/first button
  const isOnLastPage = clampedPage >= totalPages;
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_queue_nav:${clampedPage - 1}`)
        .setEmoji('\u2b06\ufe0f')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage <= 1),
      new ButtonBuilder()
        .setCustomId(`setup_queue_nav:${clampedPage + 1}`)
        .setEmoji('\u2b07\ufe0f')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages),
      // ⏬ jump to last page (turns into ⏫ to jump to first when already on last page)
      new ButtonBuilder()
        .setCustomId(isOnLastPage ? 'setup_queue_nav:1' : `setup_queue_nav:${totalPages}`)
        .setEmoji(isOnLastPage ? '\u23eb' : '\u23ec')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1),
    ),
  );

  // Header: QUEUE・N songs
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`QUEUE・${tracks.length} song${tracks.length !== 1 ? 's' : ''}`),
  );

  // ── Current track (big format) ─────────────────────────────────────────────
  const currentArtUrl = getSquareThumbnailUrl(currentTrack.thumbnail || currentTrack.artworkUrl || config.images.defaultThumbnail);
  const currentTotalDur = formatDuration(currentTrack.length);
  let currentDurLine;
  if (player.paused && player.position > 0) {
    currentDurLine = `-# ${formatDuration(player.position)} / ${currentTotalDur}`;
  } else {
    currentDurLine = `-# ${currentTotalDur}`;
  }

  // Absolute index of the currently playing track
  const currentAbsIdx = player.data?.get('absoluteQueueIndex') ?? 1;
  const currentRequesterId = currentTrack.requester?.id || null;
  const currentRequesterStr = currentRequesterId ? `<@${currentRequesterId}>` : '';
  const currentRequesterLine = currentRequesterStr ? `-# \`${currentAbsIdx}\`・${currentRequesterStr}` : `-# \`${currentAbsIdx}\``;

  const currentTrackText =
    `### ${config.emojis.music}  ${currentTrack.title}\n` +
    `${currentTrack.author || 'Unknown'}\n` +
    `${currentDurLine}\n` +
    currentRequesterLine;

  const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(currentTrackText))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(currentArtUrl));
  container.addSectionComponents(section);

  // ── Upcoming tracks (compact format, one Separator between each) ───────────
  if (pageTracks.length > 0) {
    pageTracks.forEach((t, i) => {
      container.addSeparatorComponents(new SeparatorBuilder());
      const absIdx = currentAbsIdx + start + i + 1;
      const requesterId = t.requester?.id || null;
      const requesterStr = requesterId ? `<@${requesterId}>` : '';
      const requesterLine = requesterStr ? `-# \`${absIdx}\`・${requesterStr}` : `-# \`${absIdx}\``;
      const trackText = `**${t.title}** - ${t.author || 'Unknown'}\n${requesterLine}`;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trackText));
    });
  } else {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('*No upcoming tracks.*'),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // ── Manage Queue dropdown ──────────────────────────────────────────────────
  const manageOptions = [
    new StringSelectMenuOptionBuilder()
      .setLabel('Clear Queue')
      .setEmoji('🗑️')
      .setDescription('Remove all upcoming tracks from the queue')
      .setValue('clear_queue'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Reverse Queue')
      .setEmoji('🔃')
      .setDescription('Reverse the order of upcoming tracks')
      .setValue('reverse_queue'),
  ];

  // Only show Remove option when there are upcoming tracks
  if (tracks.length > 0) {
    manageOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel('Remove Tracks')
        .setEmoji('❌')
        .setDescription('Select specific tracks to remove from the queue')
        .setValue('remove_tracks'),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_manage_queue')
        .setPlaceholder('🎚️ Manage Queue')
        .addOptions(manageOptions),
    ),
  );

  // ── Recommendations dropdown ───────────────────────────────────────────────
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    const recOptions = recommendations.slice(0, 10).map((t, i) => {
      const raw = t.title || 'Unknown';
      const label = raw.length > SELECT_OPTION_MAX_LENGTH ? raw.slice(0, SELECT_OPTION_MAX_LENGTH - 3) + '...' : raw;
      const rawDesc = `${t.author || 'Unknown'} — ${formatDuration(t.length)}`;
      const desc = rawDesc.length > SELECT_OPTION_MAX_LENGTH ? rawDesc.slice(0, SELECT_OPTION_MAX_LENGTH - 3) + '...' : rawDesc;
      return new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setDescription(desc)
        .setValue(`rec:${i}`);
    });

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup_recommend_select')
          .setPlaceholder('✨ Recommend — Add a related song to queue')
          .addOptions(recOptions),
      ),
    );
  }

  // Control Row 1 (Previous, Pause, Skip, Stop)
  container.addActionRowComponents(buildSetupButtonsV2(player));
  // Control Row 2 (Queue [green], Shuffle)
  container.addActionRowComponents(buildSetupRow2V2(true));
  // Control Row 3 (Controls dropdown)
  container.addActionRowComponents(buildSetupControlsDropdownV2());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build a progress bar string in the format ▬▬▬▬🔘▬▬▬▬
 * The 🔘 position represents the current playback position.
 * @param {number} position - Current position in ms
 * @param {number} total - Total duration in ms
 * @param {number} [bars=10] - Total number of bar segments
 * @returns {string}
 */
function buildProgressBar(position, total, bars = 10) {
  if (!total || total <= 0) return '▬'.repeat(bars);
  const progress = Math.min(1, position / total);
  const filled = Math.round(progress * bars);
  const left = '▬'.repeat(Math.max(0, filled));
  const right = '▬'.repeat(Math.max(0, bars - filled - 1));
  return `${left}🔘${right}`;
}

/**
 * Build the Now Playing rich embed for the /nowplaying and !np commands.
 * Always uses a small thumbnail (no large art), never ComponentV2.
 * Includes Artists, Progress bar, Source, Requested By fields.
 * Author shows the requester's avatar and "Now Playing" text.
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @returns {{ embeds: EmbedBuilder[] }}
 */
function buildNowPlayingEmbed(track, player) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const requester = track.requester;
  const requesterName = requester
    ? requester.displayName || requester.username || requester.tag || 'Unknown'
    : 'Unknown';
  // Always use 1:1 square thumbnail for the nowplaying embed; prefer artworkUrl (1:1 album art)
  const rawArtUrl = track.artworkUrl || track.thumbnail || config.images.defaultThumbnail;
  const thumbUrl = getSquareThumbnailUrl(rawArtUrl);

  const isPaused = player.paused;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';
  const position = player.position || 0;
  const total = track.length || 0;
  const progressBar = buildProgressBar(position, total);
  const progressStr = `${formatDuration(position)} / ${formatDuration(total)}`;

  const accentColor = player.data?.get('accentColor');

  // Author: requester avatar + "Now Playing" text
  const authorIconUrl = requester?.displayAvatarURL?.({ size: 64 }) || null;

  const embed = new EmbedBuilder()
    .setColor(accentColor ?? config.embeds.color)
    .setAuthor({ name: `Now Playing${loopMode}`, iconURL: authorIconUrl || undefined })
    .setTitle(track.title)
    .setURL(track.uri || null)
    .setThumbnail(thumbUrl)
    .addFields(
      { name: '🎤 Artists', value: track.author || 'Unknown', inline: true },
      { name: '⏱️ Duration', value: formatDuration(total), inline: true },
      { name: `${platformEmoji} Source`, value: sourceDisplay, inline: true },
      { name: '📊 Progress', value: `${isPaused ? '⏸️' : '▶️'} ${progressBar}\n\`${progressStr}\``, inline: false },
      { name: '👤 Requested By', value: requesterName, inline: true },
      { name: '📋 Queue', value: player.queue.length > 0 ? `${player.queue.length} track(s)` : 'Nothing', inline: true },
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();

  return { embeds: [embed] };
}

/**
 * Build the Now Playing Component v2 message payload WITHOUT control buttons.
 * Used by the /nowplaying command so it doesn't duplicate the interactive controls.
 * Shows elapsed / total time as [01:15 / 03:45].
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {boolean} [largeArt=true] - Show art as large gallery image
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildNowPlayingV2NoButtons(track, player, largeArt = true) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const requester = track.requester;
  const requesterName = requester
    ? requester.displayName || requester.username || requester.tag || 'Unknown'
    : 'Unknown';
  const isSquare = getThumbnailDisplayMode(track) === 'square';
  // Prefer artworkUrl (1:1 album art) over thumbnail (16:9 video) for non-yt tracks
  const rawArtUrl = isSquare
    ? (track.artworkUrl || track.thumbnail || config.images.defaultThumbnail)
    : (track.thumbnail || track.artworkUrl || config.images.defaultThumbnail);
  const artUrl = isSquare ? getSquareThumbnailUrl(rawArtUrl) : rawArtUrl;

  const isPaused = player.paused;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';
  const statusText = isPaused
    ? `${platformEmoji} **Paused**${loopMode}`
    : `${platformEmoji} **Now Playing**${loopMode}`;

  const position = player.position || 0;
  const total = track.length || 0;
  const progressStr = `[${formatDuration(position)} / ${formatDuration(total)}]`;

  const container = new ContainerBuilder();

  // Apply dynamic accent color if available
  const accentColor = player.data?.get('accentColor');
  if (accentColor != null) container.setAccentColor(accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(statusText),
  );

  const detailText =
    `## ${track.title}\n` +
    `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
    `${platformEmoji}: ${sourceDisplay}\n` +
    `⏱️ **Progress:** ${progressStr}\n` +
    `👤 **Requested by:** ${requesterName}`;

  if (largeArt) {
    // Always use MediaGalleryBuilder so the image renders large.
    // For non-wide (YTM/Spotify) tracks the CDN already returns a square crop
    // via getSquareThumbnailUrl, so the gallery renders large AND square.
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
    );
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText));
  } else {
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailText))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));
    container.addSectionComponents(section);
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build the "Added to Queue" Component v2 message payload (small thumbnail).
 * @param {object} track - KazagumoTrack
 * @param {number} queueSize - Number of tracks in queue after adding
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildAddedToQueueV2(track, queueSize) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const artUrl = track.artworkUrl || track.thumbnail || config.images.defaultThumbnail;

  const container = new ContainerBuilder();

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${config.emojis.queue} Added to Queue\n` +
          `### ${track.title}\n` +
          `🎤  ${track.author || 'Unknown'}\n` +
          `${platformEmoji}: ${sourceDisplay}\n` +
          `⏱️  ${formatDuration(track.length)}\n` +
          `📋  #${queueSize}`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));

  container.addSectionComponents(section);
  container.addSeparatorComponents(new SeparatorBuilder());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build the "Added Playlist to Queue" Component v2 message payload (small thumbnail).
 * @param {string} playlistName - Playlist name
 * @param {number} trackCount - Number of tracks added
 * @param {string} [artUrl] - Thumbnail URL
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildAddedPlaylistV2(playlistName, trackCount, artUrl) {
  const imageUrl = artUrl || config.images.defaultThumbnail;
  const container = new ContainerBuilder();

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${config.emojis.queue} Playlist Added to Queue\n` +
          `### ${playlistName}\n` +
          `📋 **Tracks:** ${trackCount} song${trackCount !== 1 ? 's' : ''} added`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));

  container.addSectionComponents(section);
  container.addSeparatorComponents(new SeparatorBuilder());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ─── Queue Component v2 Builder ───────────────────────────────────────────────

/** Number of tracks shown per queue page. */
const QUEUE_PAGE_SIZE = 10;

/**
 * Build the Queue Component v2 message payload with optional pagination and
 * a per-page dropdown that lets users move a track to the front of the queue.
 *
 * @param {object} current   - KazagumoTrack (now playing)
 * @param {object[]} tracks  - Upcoming tracks array
 * @param {number} page      - Current page (1-based)
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildQueueV2(current, tracks, page = 1) {
  const totalPages = Math.max(1, Math.ceil(tracks.length / QUEUE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * QUEUE_PAGE_SIZE;
  const pageTracks = tracks.slice(start, start + QUEUE_PAGE_SIZE);

  const currentEmoji = resolvePlatformEmoji(current.sourceName);
  const container = new ContainerBuilder();

  // ── Header ──────────────────────────────────────────────────────────────────
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${config.emojis.queue} Music Queue — Page ${clampedPage}/${totalPages}\n` +
        `**Now Playing:** ${currentEmoji} ${current.title} — \`${formatDuration(current.length)}\``,
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  // ── Track list ───────────────────────────────────────────────────────────────
  const trackListText = pageTracks.length
    ? pageTracks
        .map((t, i) => {
          const emoji = resolvePlatformEmoji(t.sourceName);
          return `**${start + i + 1}.** ${emoji} ${t.title} — \`${formatDuration(t.length)}\``;
        })
        .join('\n')
    : '*No upcoming tracks.*';

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trackListText));

  // ── Navigation buttons (only when there are multiple pages) ──────────────────
  if (totalPages > 1) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`queue_nav:${clampedPage - 1}`)
          .setEmoji(config.emojis.previous)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage <= 1),
        new ButtonBuilder()
          .setCustomId(`queue_nav:${clampedPage + 1}`)
          .setEmoji(config.emojis.skip)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(clampedPage >= totalPages),
      ),
    );
  }

  // ── Dropdown (tracks on current page) ────────────────────────────────────────
  if (pageTracks.length > 0) {
    const options = pageTracks.map((t, i) => {
      const raw = t.title;
      const label =
        raw.length > SELECT_OPTION_MAX_LENGTH ? raw.slice(0, SELECT_OPTION_MAX_LENGTH - 3) + '...' : raw;
      const rawDesc = `${t.author || 'Unknown'} — ${formatDuration(t.length)}`;
      const desc =
        rawDesc.length > SELECT_OPTION_MAX_LENGTH
          ? rawDesc.slice(0, SELECT_OPTION_MAX_LENGTH - 3) + '...'
          : rawDesc;
      return new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setDescription(desc)
        .setValue(String(start + i));
    });

    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('queue_select')
          .setPlaceholder('Move a track to play next…')
          .addOptions(options),
      ),
    );
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build the "Play Next" confirmation Component v2 message payload.
 *
 * @param {object} track - KazagumoTrack that was moved to the front
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildPlayNextConfirmV2(track) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const artUrl = track.artworkUrl || track.thumbnail || config.images.defaultThumbnail;

  const container = new ContainerBuilder();

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${config.emojis.skip} Play Next\n` +
          `## ${track.title}\n` +
          `🎤  ${track.author || 'Unknown'}\n` +
          `${platformEmoji}: ${sourceDisplay}\n` +
          `⏱️  ${formatDuration(track.length)}\n` +
          `▶️ This track will play immediately after the current song.`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));

  container.addSectionComponents(section);
  container.addSeparatorComponents(new SeparatorBuilder());

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ─── Standalone Queue Builder (10 per page) ───────────────────────────────────

/** Number of tracks shown per page in the standalone !queue / /queue command. */
const QUEUE_STANDALONE_PAGE_SIZE = 10;

/**
 * Build the standalone Queue Component v2 message payload (10 per page).
 * Includes navigation buttons and a ❌ Delete button.
 * Uses absolute queue numbers that don't reset until the queue is cleared.
 *
 * @param {object} current   - KazagumoTrack (now playing)
 * @param {object[]} tracks  - Upcoming tracks array
 * @param {number} page      - Current page (1-based)
 * @param {number} [absoluteOffset=1] - Absolute index of the currently playing track
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildQueueStandaloneV2(current, tracks, page = 1, absoluteOffset = 1) {
  const totalPages = Math.max(1, Math.ceil(tracks.length / QUEUE_STANDALONE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * QUEUE_STANDALONE_PAGE_SIZE;
  const pageTracks = tracks.slice(start, start + QUEUE_STANDALONE_PAGE_SIZE);

  const currentEmoji = resolvePlatformEmoji(current.sourceName);
  const container = new ContainerBuilder();

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${config.emojis.queue} Music Queue — Page ${clampedPage}/${totalPages}\n` +
        `**Now Playing (#${absoluteOffset}):** ${currentEmoji} ${current.title} — \`${formatDuration(current.length)}\``,
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  // Track list — numbers continue from where the current track's absolute index is
  const trackListText = pageTracks.length
    ? pageTracks
        .map((t, i) => {
          const emoji = resolvePlatformEmoji(t.sourceName);
          const absNum = absoluteOffset + start + i + 1;
          return `**${absNum}.** ${emoji} ${t.title} — \`${formatDuration(t.length)}\``;
        })
        .join('\n')
    : '*No upcoming tracks.*';

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trackListText));

  container.addSeparatorComponents(new SeparatorBuilder());

  // Navigation + Delete row (always shown)
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`queue_standalone_nav:${clampedPage - 1}`)
        .setEmoji(config.emojis.previous)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage <= 1),
      new ButtonBuilder()
        .setCustomId(`queue_standalone_nav:${clampedPage + 1}`)
        .setEmoji(config.emojis.skip)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages),
      new ButtonBuilder()
        .setCustomId('queue_delete')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

/**
 * Build a simple Component v2 confirmation panel (used by join/disconnect commands).
 * @param {string} text - The confirmation message text
 * @param {number} [accentColor] - Optional accent color
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildConfirmV2(text, accentColor) {
  const container = new ContainerBuilder();
  if (accentColor != null) container.setAccentColor(accentColor);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = {
  buildPlayerButtonsV2,
  buildDisabledButtonsV2,
  buildMoreOptionsDropdown,
  buildNowPlayingV2,
  buildNowPlayingV2NoButtons,
  buildNowPlayingEmbed,
  buildAddedToQueueV2,
  buildAddedPlaylistV2,
  buildIdleV2,
  buildSetupIdleV2,
  buildSetupNowPlayingV2,
  buildSetupButtonsV2,
  buildSetupDisabledButtonsV2,
  buildSetupRow2V2,
  buildSetupRow2DisabledV2,
  buildSetupControlsDropdownV2,
  buildSetupControlsDropdownDisabledV2,
  buildSetupQueueViewV2,
  extractDominantColor,
  getSquareThumbnailUrl,
  buildQueueV2,
  buildQueueStandaloneV2,
  buildPlayNextConfirmV2,
  buildConfirmV2,
  buildProgressBar,
  QUEUE_PAGE_SIZE,
  QUEUE_STANDALONE_PAGE_SIZE,
  SETUP_QUEUE_PAGE_SIZE,
  PLAY_NEXT_DELETE_DELAY_MS,
};
