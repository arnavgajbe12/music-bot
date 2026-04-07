const fs = require('fs');
const path = require('path');

/**
 * Recursively load all command files from a directory
 * @param {string} dir
 * @param {function} callback - called with (filePath)
 */
function loadFiles(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadFiles(fullPath, callback);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      callback(fullPath);
    }
  }
}

/**
 * @param {import('discord.js').Client} client
 */
module.exports = (client) => {
  // Load prefix commands
  const prefixDir = path.join(__dirname, '..', 'commands', 'prefix');
  loadFiles(prefixDir, (filePath) => {
    const command = require(filePath);
    if (!command.name) return;
    client.commands.set(command.name, command);
    if (command.aliases && Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.commands.set(alias, command);
      }
    }
    console.log(`[Commands] Loaded prefix command: ${command.name}`);
  });

  // Load slash commands
  const slashDir = path.join(__dirname, '..', 'commands', 'slash');
  loadFiles(slashDir, (filePath) => {
    const command = require(filePath);
    if (!command.data) return;
    client.slashCommands.set(command.data.name, command);
    console.log(`[Commands] Loaded slash command: ${command.data.name}`);
  });

  console.log(`[Commands] Loaded ${client.commands.size} prefix command(s), ${client.slashCommands.size} slash command(s).`);
};
