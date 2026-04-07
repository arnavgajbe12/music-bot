module.exports = {
  botSetup: {
    prefix: '!',
    devs: ['YOUR_DISCORD_USER_ID_HERE'],
  },

  logs: {
    lavalinkLogChannel: 'YOUR_LAVALINK_LOG_CHANNEL_ID',
    commandLogChannel: 'YOUR_COMMAND_LOG_CHANNEL_ID',
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
      youtubemusic: '▶️',
    },
  },

  images: {
    nowPlayingBanner: 'https://i.imgur.com/your-banner.png',
    defaultThumbnail: 'https://i.imgur.com/your-thumbnail.png',
  },

  links: {
    invite: 'https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands',
    supportServer: 'https://discord.gg/your-server',
  },
};
