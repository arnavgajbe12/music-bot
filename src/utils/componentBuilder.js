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
  MessageFlags,
} = require('discord.js');
const config = require('../../config');
const { formatDuration, resolvePlatformEmoji, resolveSourceDisplayName } = require('./embeds');

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

module.exports = {
  buildPlayerButtonsV2,
  buildDisabledButtonsV2,
  buildNowPlayingV2,
  buildIdleV2,
  buildSetupIdleV2,
};
