module.exports = {
  once: true,
  run(client) {
    console.log(`[Ready] Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: '🎵 Music | Use /play', type: 2 }],
      status: 'online',
    });
  },
};
