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
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;

  // Dynamic small status line shown above the (large) song title
  const isPaused = player.paused;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';
  const statusText = isPaused
    ? `${platformEmoji} **Paused**${loopMode}`
    : `${platformEmoji} **Now Playing**${loopMode}`;

  const container = new ContainerBuilder();

  // Small dynamic status header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(statusText),
  );

  const detailText =
    `## ${track.title}\n` +
    `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
    `${platformEmoji} **Source:** ${sourceDisplay}\n` +
    `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
    `👤 **Requested by:** ${requesterName}`;

  if (largeArt) {
    // Large album art as gallery
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
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
 * Queue (🎛️), Shuffle (🔀), Vol Down (🔉), Vol Up (🔊).
 * When isQueueView is true, the Queue button is highlighted green.
 * @param {boolean} [isQueueView=false]
 * @returns {ActionRowBuilder}
 */
function buildSetupRow2V2(isQueueView = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_queue')
      .setEmoji('🎛️')
      .setStyle(isQueueView ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_shuffle')
      .setEmoji(config.emojis.shuffle)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_vol_down')
      .setEmoji(config.emojis.volumeDown)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_vol_up')
      .setEmoji(config.emojis.volumeUp)
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
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('setup_shuffle')
      .setEmoji(config.emojis.shuffle)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('setup_vol_down')
      .setEmoji(config.emojis.volumeDown)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('setup_vol_up')
      .setEmoji(config.emojis.volumeUp)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

/**
 * Build the Setup Channel Now Playing Component v2 panel.
 * This is the permanent panel in the song-request channel.
 *
 * Layout:
 *  - Dynamic accent color (extracted from thumbnail, random on failure)
 *  - Header (medium text): Emoji Source Name - [Song Title](URL)
 *  - Large image: track thumbnail
 *  - Body (large text): ## Song Title  (no link)
 *  - Subtext: Artist • Duration
 *  - Separator
 *  - Row 1: ⏮️ Previous | ⏯️ Pause | ⏭️ Skip | ⏹️ Stop
 *  - Row 2: 🎛️ Queue | 🔀 Shuffle | 🔉 Vol Down | 🔊 Vol Up
 *
 * NOTE: No user pings anywhere.
 *
 * @param {object} track  - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {number} [accentColor] - Pre-computed accent color (integer). If omitted
 *   the function will attempt extraction asynchronously — caller should pass the
 *   result of `extractDominantColor` to avoid blocking.
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupNowPlayingV2(track, player, accentColor) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;
  const trackUrl = track.uri || null;

  // Clickable header: 🔴 YouTube Music - [Blinding Lights](https://...)
  const headerText = trackUrl
    ? `${platformEmoji} ${sourceDisplay} - [${track.title}](${trackUrl})`
    : `${platformEmoji} ${sourceDisplay} - ${track.title}`;

  const container = new ContainerBuilder();

  // Apply accent color (left color stripe)
  const color =
    accentColor != null ? accentColor : Math.floor(Math.random() * 0xffffff);
  container.setAccentColor(color);

  // Small clickable header line
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerText),
  );

  // Large thumbnail image
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
  );

  // Large song title (## = large text, no link)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${track.title}`),
  );

  // Artist • Duration subtext
  const artist = track.author || 'Unknown Artist';
  const duration = formatDuration(track.length);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${artist} • ${duration}`),
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildSetupButtonsV2(player));
  container.addActionRowComponents(buildSetupRow2V2(false));

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
 * Replaces the large image with a 5-song list (1 current + 4 upcoming).
 * The Queue button (Row 2) is highlighted green while in this view.
 * Navigation buttons (⬆️ / ⬇️) are added above the control rows.
 *
 * @param {object} currentTrack - KazagumoTrack (currently playing)
 * @param {object[]} tracks     - Upcoming tracks array
 * @param {number} page         - Current page (1-based)
 * @param {number} accentColor  - Pre-computed accent color (integer)
 * @param {object} player       - KazagumoPlayer (for control buttons state)
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupQueueViewV2(currentTrack, tracks, page = 1, accentColor, player) {
  const totalPages = Math.max(1, Math.ceil(tracks.length / SETUP_QUEUE_PAGE_SIZE));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * SETUP_QUEUE_PAGE_SIZE;
  const pageTracks = tracks.slice(start, start + SETUP_QUEUE_PAGE_SIZE);

  const container = new ContainerBuilder();
  const color = accentColor != null ? accentColor : Math.floor(Math.random() * 0xffffff);
  container.setAccentColor(color);

  // Current track header
  const currentEmoji = resolvePlatformEmoji(currentTrack.sourceName);
  const currentArtUrl = currentTrack.thumbnail || currentTrack.artworkUrl || config.images.defaultThumbnail;
  const currentTrackUrl = currentTrack.uri || null;
  const currentTitle = currentTrackUrl
    ? `[${currentTrack.title}](${currentTrackUrl})`
    : currentTrack.title;

  // Section: current track with small thumbnail accessory
  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `▶️ **Now Playing**\n${currentEmoji} **${currentTitle}**\n${currentTrack.author || 'Unknown'} • ${formatDuration(currentTrack.length)}`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(currentArtUrl));
  container.addSectionComponents(section);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Upcoming tracks list
  const trackListText = pageTracks.length
    ? pageTracks
        .map((t, i) => {
          const emoji = resolvePlatformEmoji(t.sourceName);
          return `**${start + i + 1}.** ${emoji} ${t.title} — \`${formatDuration(t.length)}\``;
        })
        .join('\n')
    : '*No upcoming tracks.*';

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(trackListText));

  container.addSeparatorComponents(new SeparatorBuilder());

  // Navigation row (⬆️ Prev page / ⬇️ Next page)
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_queue_nav:${clampedPage - 1}`)
        .setEmoji('⬆️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage <= 1),
      new ButtonBuilder()
        .setCustomId(`setup_queue_nav:${clampedPage + 1}`)
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(clampedPage >= totalPages),
    ),
  );

  // Control Row 1 (Previous, Pause, Skip, Stop) — always visible
  container.addActionRowComponents(buildSetupButtonsV2(player));
  // Control Row 2 (Queue [green], Shuffle, Vol Down, Vol Up) — always visible
  container.addActionRowComponents(buildSetupRow2V2(true));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
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
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;

  const isPaused = player.paused;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';
  const statusText = isPaused
    ? `${platformEmoji} **Paused**${loopMode}`
    : `${platformEmoji} **Now Playing**${loopMode}`;

  const position = player.position || 0;
  const total = track.length || 0;
  const progressStr = `[${formatDuration(position)} / ${formatDuration(total)}]`;

  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(statusText),
  );

  const detailText =
    `## ${track.title}\n` +
    `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
    `${platformEmoji} **Source:** ${sourceDisplay}\n` +
    `⏱️ **Progress:** ${progressStr}\n` +
    `👤 **Requested by:** ${requesterName}`;

  if (largeArt) {
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
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;

  const container = new ContainerBuilder();

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${config.emojis.queue} Added to Queue\n` +
          `### ${track.title}\n` +
          `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
          `${platformEmoji} **Source:** ${sourceDisplay}\n` +
          `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
          `📋 **Position:** #${queueSize}`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));

  container.addSectionComponents(section);

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

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

// ─── Queue Component v2 Builder ───────────────────────────────────────────────

/** Number of tracks shown per queue page. */
const QUEUE_PAGE_SIZE = 5;

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
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;

  const container = new ContainerBuilder();

  const section = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${config.emojis.skip} Play Next\n` +
          `### ${track.title}\n` +
          `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
          `${platformEmoji} **Source:** ${sourceDisplay}\n` +
          `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
          `▶️ This track will play immediately after the current song.`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));

  container.addSectionComponents(section);

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
 *
 * @param {object} current   - KazagumoTrack (now playing)
 * @param {object[]} tracks  - Upcoming tracks array
 * @param {number} page      - Current page (1-based)
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildQueueStandaloneV2(current, tracks, page = 1) {
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
        `**Now Playing:** ${currentEmoji} ${current.title} — \`${formatDuration(current.length)}\``,
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  // Track list
  const trackListText = pageTracks.length
    ? pageTracks
        .map((t, i) => {
          const emoji = resolvePlatformEmoji(t.sourceName);
          return `**${start + i + 1}.** ${emoji} ${t.title} — \`${formatDuration(t.length)}\``;
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
  buildAddedToQueueV2,
  buildAddedPlaylistV2,
  buildIdleV2,
  buildSetupIdleV2,
  buildSetupNowPlayingV2,
  buildSetupButtonsV2,
  buildSetupDisabledButtonsV2,
  buildSetupRow2V2,
  buildSetupRow2DisabledV2,
  buildSetupQueueViewV2,
  extractDominantColor,
  buildQueueV2,
  buildQueueStandaloneV2,
  buildPlayNextConfirmV2,
  buildConfirmV2,
  QUEUE_PAGE_SIZE,
  QUEUE_STANDALONE_PAGE_SIZE,
  SETUP_QUEUE_PAGE_SIZE,
  PLAY_NEXT_DELETE_DELAY_MS,
};
