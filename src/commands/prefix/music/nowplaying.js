const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildNowPlayingV2NoButtons } = require('../../../utils/componentBuilder');
const { getSettings } = require('../../../utils/setupManager');

module.exports = {
  name: 'nowplaying',
  aliases: ['np', 'current'],
  description: 'Show the currently playing track.',
  usage: '',

  async run(client, message) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now.')] });
    }

    // Delete the previous !np message if one exists
    const oldNpMsg = player.data.get('npCmdMessage');
    if (oldNpMsg) {
      oldNpMsg.delete().catch(() => {});
      player.data.delete('npCmdMessage');
    }

    const settings = getSettings(message.guild.id);
    const payload = buildNowPlayingV2NoButtons(player.queue.current, player, settings.largeArt);

    const msg = await message.reply(payload);
    player.data.set('npCmdMessage', msg);
  },
};

