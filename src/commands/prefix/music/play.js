const { buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Play a song or add it to the queue.',
  usage: '<song name or URL>',

  async run(client, message, args) {
    if (!args.length) {
      return message.reply({ embeds: [buildErrorEmbed('Please provide a song name or URL.')] });
    }

    const voiceCheck = checkVoice(message.member, message.guild);
    if (!voiceCheck.ok) {
      return message.reply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const query = args.join(' ');
    const voiceChannel = message.member.voice.channel;

    await message.channel.sendTyping();

    let player = client.manager.players.get(message.guild.id);
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

    let result;
    try {
      result = await client.manager.search(query, { requester: message.author });
    } catch (error) {
      return message.reply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
    }

    if (!result || !result.tracks.length) {
      return message.reply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    let replyContent;
    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      replyContent = `✅ Added **${result.tracks.length}** tracks from **${result.playlistName}** to the queue.`;
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      replyContent = `✅ Added **${track.title}** to the queue.`;
    }

    // Send a brief reply, then delete it after 5 s so chat stays clean
    const reply = await message.reply(replyContent);
    setTimeout(() => reply.delete().catch(() => {}), 5000);

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
