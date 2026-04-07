const { buildPlatformPrefixCommand } = require('../../../utils/platformPlayBuilder');
module.exports = buildPlatformPrefixCommand('az', ['amazonmusic'], 'Search and play from Amazon Music.', 'amsearch:', 'Amazon Music');
