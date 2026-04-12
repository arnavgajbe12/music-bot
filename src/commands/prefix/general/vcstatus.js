const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');

module.exports = {
  name: 'vcstatus',
  aliases: ['setstatus'],
  description: 'Set or clear the voice channel status.',
  usage: '[status text]',

  async run(client, message, args) {
    const player = client.manager.players.get(message.guild.id);
    const voiceChannelId = player?.voiceId ?? message.member.voice?.channel?.id;

    if (!voiceChannelId) {
      return message.channel.send({
        embeds: [buildErrorEmbed('No active voice channel found. Join a voice channel or start playing music first.')],
      });
    }

    const statusText = args.join(' ');

    try {
      await client.rest.put(`/channels/${voiceChannelId}/voice-status`, {
        body: { status: statusText },
      });

      const text = statusText
        ? `🎙️ Voice channel status set to: **${statusText}**`
        : '🎙️ Voice channel status has been cleared.';

      return message.channel.send({ embeds: [buildEmbed(text)] });
    } catch (error) {
      console.error('[vcstatus]', error);
      return message.channel.send({
        embeds: [buildErrorEmbed('Failed to update the voice channel status. Make sure the bot has the **Manage Channels** permission in the voice channel.')],
      });
    }
  },
};
