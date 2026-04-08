module.exports = {
  botSetup: {
    prefix: '!',
    devs: process.env.DEV_IDS ? process.env.DEV_IDS.split(',').map((id) => id.trim()) : [],
  },

  logs: {
    lavalinkLogChannel: process.env.LAVALINK_LOG_CHANNEL_ID || null,
    commandLogChannel: process.env.COMMAND_LOG_CHANNEL_ID || null,
  },

  player: {
    defaultSearchPlatform: 'ytmsearch',
    defaultVolume: 100,
    leaveOnEmpty: true,
  },

  embeds: {
    color: 0x5865f2,
    errorColor: 0xed4245,
    footerText: 'Music Bot • Powered by Lavalink v4',
  },

  emojis: {
    success: '✅',
    error: '❌',
    music: '🎵',
    play: '▶️',
    pause: '⏸️',
    skip: '⏭️',
    previous: '⏮️',
    stop: '⏹️',
    loop: '🔁',
    shuffle: '🔀',
    queue: '📋',
    volumeUp: '🔊',
    volumeDown: '🔉',
    platforms: {
      spotify: '🟢',
      jiosaavn: '🎵',
      applemusic: '🍎',
      soundcloud: '🔶',
      amazonmusic: '📦',
      deezer: '🎶',
      youtube: '▶️',
      youtubemusic: '🔴',
    },
  },

  images: {
    nowPlayingBanner: process.env.NOW_PLAYING_BANNER_URL || null,
    defaultThumbnail: process.env.DEFAULT_THUMBNAIL_URL || 'https://i.imgur.com/AfFp7pu.png',
  },

  links: {
    invite: process.env.CLIENT_ID
      ? `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`
      : null,
    supportServer: process.env.SUPPORT_SERVER_INVITE || null,
  },
};
