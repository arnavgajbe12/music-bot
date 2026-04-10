const { buildPlatformPrefixCommand } = require('../../../utils/platformPlayBuilder');
module.exports = buildPlatformPrefixCommand('yt', ['youtube'], 'Search and play from YouTube.', 'ytsearch:', 'YouTube', { useWide: true });
