require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const slashDir = path.join(__dirname, 'src', 'commands', 'slash');

// Recursively collect slash command data
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`[Deploy] Loaded: ${command.data.name}`);
      }
    }
  }
}

loadCommands(slashDir);

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} slash command(s) globally...`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('[Deploy] Successfully registered all slash commands!');
  } catch (error) {
    console.error('[Deploy] Error registering commands:', error);
  }
})();
