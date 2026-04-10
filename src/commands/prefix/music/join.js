const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildConfirmV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  name: 'join',
  aliases: [],
  description: 'Join your voice channel.',
  usage: '',

  async run(client, message) {
    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const voiceChannel = message.member.voice.channel;

    // Always destroy any existing player so we get a clean connection
    const existingPlayer = client.manager.players.get(message.guild.id);
    if (existingPlayer) {
      const botVoiceChannelId = message.guild.members.me?.voice?.channelId;
      if (botVoiceChannelId && botVoiceChannelId === voiceChannel.id) {
        return message.channel.send({ embeds: [buildErrorEmbed(`I'm already in **${voiceChannel.name}**!`)] });
      }
      existingPlayer.data.set('intentionalDisconnect', true);
      await existingPlayer.destroy().catch(() => {});
    }

    const player = await client.manager.createPlayer({
      guildId: message.guild.id,
      voiceId: voiceChannel.id,
      textId: message.channel.id,
      deaf: true,
      shardId: message.guild.shardId ?? 0,
    });
    player.data.set('textChannel', message.channel.id);

    const payload = buildConfirmV2(`✅ Joined **${voiceChannel.name}**!`, 0x57f287);
    const reply = await message.channel.send(payload);
    setTimeout(() => reply.delete().catch(() => {}), 10000);
  },
};
