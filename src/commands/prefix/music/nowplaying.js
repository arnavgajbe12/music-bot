const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildNowPlayingEmbed } = require('../../../utils/componentBuilder');

module.exports = {
  name: 'nowplaying',
  aliases: ['np', 'current'],
  description: 'Show the currently playing track.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.channel.send({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    // Delete the previous !np message if one exists (no duplicates)
    const oldNpMsg = player.data.get('npCmdMessage');
    if (oldNpMsg) {
      oldNpMsg.delete().catch(() => {});
      player.data.delete('npCmdMessage');
    }

    const payload = buildNowPlayingEmbed(player.queue.current, player);

    // Send without pinging the user (item 6)
    const msg = await message.channel.send({ ...payload, allowedMentions: { repliedUser: false } });
    player.data.set('npCmdMessage', msg);
  },
};

