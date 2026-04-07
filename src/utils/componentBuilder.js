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
const config = require('../../config');
const { formatDuration, resolvePlatformEmoji, resolveSourceDisplayName } = require('./embeds');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum length of a Discord select-menu option label/description. */
const SELECT_OPTION_MAX_LENGTH = 100;

/** Auto-delete delay (ms) for ephemeral "play next" confirmation messages. */
const PLAY_NEXT_DELETE_DELAY_MS = 15000;

// ─── Button Builders ──────────────────────────────────────────────────────────

/**
 * Build the full music player control row (with loop button).
 * @param {object} player - KazagumoPlayer
 * @returns {ActionRowBuilder}
 */
function buildPlayerButtonsV2(player) {
  const hasPrevious = player.queue.previous !== null && player.queue.previous !== undefined;
  const isPaused = player.paused;
  const isLooping = player.loop && player.loop !== 'none';

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
    new ButtonBuilder()
      .setCustomId('player_loop')
      .setEmoji(config.emojis.loop)
      .setStyle(isLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
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
    new ButtonBuilder()
      .setCustomId('player_loop')
      .setEmoji(config.emojis.loop)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
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
  const requesterTag = requester ? `<@${requester.id}>` : 'Unknown';
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';

  const container = new ContainerBuilder();

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${config.emojis.music} Now Playing${loopMode}`),
  );

  if (largeArt) {
    // Large album art as gallery
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${track.title}\n` +
          `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
          `${platformEmoji} **Source:** ${sourceDisplay}\n` +
          `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
          `👤 **Requested by:** ${requesterTag}`,
      ),
    );
  } else {
    // Small thumbnail in a section accessory
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${track.title}\n` +
            `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
            `${platformEmoji} **Source:** ${sourceDisplay}\n` +
            `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
            `👤 **Requested by:** ${requesterTag}`,
        ),
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(artUrl));
    container.addSectionComponents(section);
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(buildPlayerButtonsV2(player));

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
    new TextDisplayBuilder().setContent(`## ${config.emojis.music} Queue Concluded`),
  );

  if (largeArt) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('All tracks have been played.\nUse `/play` or type a song name to add more music!'),
    );
  } else {
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          'All tracks have been played.\nUse `/play` or type a song name to add more music!',
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

/**
 * Build the initial Setup Panel (idle, no track playing).
 * @param {boolean} [largeArt=true]
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildSetupIdleV2(largeArt = true) {
  return buildIdleV2(config.images.defaultThumbnail, largeArt);
}

/**
 * Build the Now Playing Component v2 message payload WITHOUT control buttons.
 * Used by the /nowplaying command so it doesn't duplicate the interactive controls.
 * @param {object} track - KazagumoTrack
 * @param {object} player - KazagumoPlayer
 * @param {boolean} [largeArt=true] - Show art as large gallery image
 * @returns {{ components: ContainerBuilder[], flags: number }}
 */
function buildNowPlayingV2NoButtons(track, player, largeArt = true) {
  const platformEmoji = resolvePlatformEmoji(track.sourceName);
  const sourceDisplay = resolveSourceDisplayName(track.sourceName);
  const requester = track.requester;
  const requesterTag = requester ? `<@${requester.id}>` : 'Unknown';
  const artUrl = track.thumbnail || track.artworkUrl || config.images.defaultThumbnail;
  const loopMode = player.loop && player.loop !== 'none' ? ` ${config.emojis.loop} \`${player.loop}\`` : '';

  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${config.emojis.music} Now Playing${loopMode}`),
  );

  if (largeArt) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(artUrl)),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${track.title}\n` +
          `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
          `${platformEmoji} **Source:** ${sourceDisplay}\n` +
          `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
          `👤 **Requested by:** ${requesterTag}`,
      ),
    );
  } else {
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${track.title}\n` +
            `🎤 **Artist:** ${track.author || 'Unknown'}\n` +
            `${platformEmoji} **Source:** ${sourceDisplay}\n` +
            `⏱️ **Duration:** ${formatDuration(track.length)}\n` +
            `👤 **Requested by:** ${requesterTag}`,
        ),
      )
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

module.exports = {
  buildPlayerButtonsV2,
  buildDisabledButtonsV2,
  buildNowPlayingV2,
  buildNowPlayingV2NoButtons,
  buildAddedToQueueV2,
  buildAddedPlaylistV2,
  buildIdleV2,
  buildSetupIdleV2,
  buildQueueV2,
  buildPlayNextConfirmV2,
  QUEUE_PAGE_SIZE,
  PLAY_NEXT_DELETE_DELAY_MS,
};
