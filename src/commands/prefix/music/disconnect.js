const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildConfirmV2 } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  name: 'disconnect',
  aliases: ['dc', 'leave'],
  description: 'Destroy the player and forcefully disconnect the bot from the Voice Channel.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player) {
      return message.channel.send({ embeds: [buildErrorEmbed('I am not in a voice channel right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.channel.send({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const channelName = message.guild.channels.cache.get(player.voiceId)?.name || 'voice channel';

    // Mark as intentional so voiceStateUpdate doesn't double-destroy
    player.data.set('intentionalDisconnect', true);
    player.queue.clear();
    try { await player.shoukaku?.node?.destroyPlayer(message.guild.id); } catch {}
    try { await client.manager.shoukaku?.leaveVoiceChannel(message.guild.id); } catch {}
    try { await player.destroy(); } catch {}
    client.manager.players.delete(message.guild.id);

    try {
      const botVoice = message.guild.members.me?.voice;
      if (botVoice?.channel) await botVoice.disconnect();
    } catch {}

    const payload = buildConfirmV2(`👋 Left **${channelName}** and cleared the queue.`, 0xed4245);
    const reply = await message.channel.send(payload);
    setTimeout(() => reply.delete().catch(() => {}), 10000);
  },
};

