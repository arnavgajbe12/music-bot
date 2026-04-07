const { buildPlatformPrefixCommand } = require('../../../utils/platformPlayBuilder');
module.exports = buildPlatformPrefixCommand('sp', ['spotify'], 'Search and play from Spotify.', 'spsearch:', 'Spotify');
