/**
 * Shared constants used across multiple modules.
 */

/**
 * Maps metadataSource values (as stored in guild settings via /source command)
 * to the Lavalink search prefix used for querying tracks.
 *
 * Used by:
 *  - /play autocomplete
 *  - !play / /play default search
 */
const METADATA_SOURCE_TO_PREFIX = {
  youtubemusic: 'ytmsearch:',
  youtube: 'ytsearch:',
  spotify: 'spsearch:',
  applemusic: 'amsearch:',
  soundcloud: 'scsearch:',
  jiosaavn: 'jssearch:',
};

module.exports = { METADATA_SOURCE_TO_PREFIX };
