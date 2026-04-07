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
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const voiceChannel = message.member.voice.channel;

    let player = client.manager.players.get(message.guild.id);
    if (player && player.voiceId === voiceChannel.id) {
      return message.reply({ embeds: [buildErrorEmbed(`I'm already in **${voiceChannel.name}**!`)] });
    }

    if (!player) {
      player = await client.manager.createPlayer({
        guildId: message.guild.id,
        voiceId: voiceChannel.id,
        textId: message.channel.id,
        deaf: true,
        shardId: message.guild.shardId ?? 0,
      });
      player.data.set('textChannel', message.channel.id);
    }

    const payload = buildConfirmV2(`✅ Joined **${voiceChannel.name}**!`, 0x57f287);
    const reply = await message.reply(payload);
    const timer = setTimeout(() => reply.delete().catch(() => {}), 10000);
    reply.once('delete', () => clearTimeout(timer));
  },
};
