const { buildPlatformPrefixCommand } = require('../../../utils/platformPlayBuilder');
module.exports = buildPlatformPrefixCommand('sc', ['soundcloud'], 'Search and play from SoundCloud.', 'scsearch:', 'SoundCloud');
