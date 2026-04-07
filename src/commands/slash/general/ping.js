const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency.'),

  async run(client, interaction) {
    await interaction.deferReply();

    const ping = Date.now() - interaction.createdTimestamp;
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

    return interaction.editReply({ embeds: [embed] });
  },
};
