const { REST, Routes } = require('discord.js');

module.exports = {
  once: true,
  async run(client) {
    console.log(`[Ready] Logged in as ${client.user.username}`);
    client.user.setPresence({
      activities: [{ name: '🎵 Music | Use /play', type: 2 }],
      status: 'online',
    });

    // ── Auto-register slash commands ─────────────────────────────────────────
    try {
      const commands = [...client.slashCommands.values()]
        .filter((cmd) => cmd.data && typeof cmd.data.toJSON === 'function')
        .map((cmd) => cmd.data.toJSON());

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log(`[Ready] Successfully registered ${commands.length} slash command(s) globally.`);
    } catch (error) {
      console.error('[Ready] Failed to register slash commands:', error);
    }
  },
};
