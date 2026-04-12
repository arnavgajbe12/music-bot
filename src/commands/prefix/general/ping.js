const { EmbedBuilder } = require('discord.js');
const config = require('../../../../config');

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check the bot latency.',
  usage: '',

  async run(client, message) {
    const sent = await message.channel.send({ content: '🏓 Pinging...' });
    const ping = sent.createdTimestamp - message.createdTimestamp;
    const wsLatency = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(config.embeds.color)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency', value: `\`${ping}ms\``, inline: true },
        { name: 'WebSocket Latency', value: `\`${wsLatency}ms\``, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: config.embeds.footerText });

    return sent.edit({ content: null, embeds: [embed] });
  },
};
