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

    const settings = getSettings(message.guild.id);
    const payload = buildNowPlayingV2NoButtons(player.queue.current, player, settings.largeArt);

    const msg = await message.reply(payload);

    // Store the message reference so playerEnd/playerStart can delete it
    const existingMsgs = player.data.get('nowPlayingCmdMessages') || [];
    existingMsgs.push(msg);
    player.data.set('nowPlayingCmdMessages', existingMsgs);
  },
};
