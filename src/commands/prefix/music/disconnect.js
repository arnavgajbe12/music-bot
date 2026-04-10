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
      return message.reply({ embeds: [buildErrorEmbed('I am not in a voice channel right now.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild, player);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const channelName = message.guild.channels.cache.get(player.voiceId)?.name || 'voice channel';

    // Clear queue and destroy player (Kazagumo destroy also handles VC leave via Shoukaku)
    player.data.set('intentionalDisconnect', true);
    player.queue.clear();
    try {
      await player.destroy();
    } catch {
      // Ignore errors from destroy – Shoukaku handles the actual disconnect
    }

    const payload = buildConfirmV2(`👋 Left **${channelName}** and cleared the queue.`, 0xed4245);
    const reply = await message.reply(payload);
    setTimeout(() => reply.delete().catch(() => {}), 10000);
  },
};

