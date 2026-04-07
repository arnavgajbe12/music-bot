const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildPlayNextConfirmV2, PLAY_NEXT_DELETE_DELAY_MS } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  name: 'playnext',
  aliases: ['pn'],
  description: 'Queue a song to play immediately after the current track.',
  usage: '<song name or URL>',

  async run(client, message, args) {
    if (!args.length) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a song name or URL.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const player = client.manager.players.get(message.guild.id);
    if (!player || !player.queue.current) {
      return message.reply({ embeds: [buildErrorEmbed('There is nothing playing right now. Use `' + config.botSetup.prefix + 'play` to start the queue first.')] });
    }

    const rawQuery = args.join(' ');
    const isUrl = /^https?:\/\//i.test(rawQuery);
    const query = isUrl ? rawQuery : `ytmsearch:${rawQuery}`;

    await message.channel.sendTyping();

    let result;
    try {
      result = await client.manager.search(query, { requester: message.author });
    } catch {
      return message.reply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
    }

    if (!result || !result.tracks.length) {
      return message.reply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    const track = result.tracks[0];

    // Unshift the track to the very front of the upcoming queue
    player.queue.unshift(track);

    const payload = buildPlayNextConfirmV2(track);
    const reply = await message.reply(payload);
    setTimeout(() => reply.delete().catch(() => {}), PLAY_NEXT_DELETE_DELAY_MS);
  },
};
