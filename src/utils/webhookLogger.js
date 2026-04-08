/**
 * webhookLogger.js
 * Utility for sending beautifully-formatted embed logs to the configured
 * ERROR_WEBHOOK_URL environment variable. Used for maximum debug visibility.
 */

const { WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('../../config');

/**
 * Send a detailed log embed to the error/debug webhook.
 *
 * @param {object} options
 * @param {string}   options.title       - Embed title (shown in bold at top)
 * @param {string}   [options.description] - Main body text (truncated to 4096 chars)
 * @param {number}   [options.color]     - Integer color (default: error red from config)
 * @param {Array<{name: string, value: string, inline?: boolean}>} [options.fields]
 * @returns {Promise<void>}
 */
async function logToWebhook({ title, description, color, fields = [] }) {
  if (!process.env.ERROR_WEBHOOK_URL) return;

  try {
    const webhook = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });

    const embed = new EmbedBuilder()
      .setTitle(title.slice(0, 256))
      .setColor(color != null ? color : config.embeds.errorColor)
      .setTimestamp()
      .setFooter({ text: config.embeds.footerText });

    if (description) {
      embed.setDescription(description.slice(0, 4096));
    }

    if (fields.length > 0) {
      embed.addFields(
        fields.slice(0, 25).map((f) => ({
          name: (f.name || 'Info').slice(0, 256),
          value: (String(f.value) || 'N/A').slice(0, 1024),
          inline: f.inline || false,
        })),
      );
    }

    await webhook.send({ embeds: [embed] });
  } catch (err) {
    console.error('[WebhookLogger] Failed to send log to webhook:', err.message);
  }
}

module.exports = { logToWebhook };
