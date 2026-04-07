const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name, URL, or Spotify link').setRequired(true),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const rawQuery = interaction.options.getString('query');
    // If the query is a plain search term (not a URL), prefix it so Kazagumo/LavaSrc
    // routes it through YouTube Music by default.
    const isUrl = /^https?:\/\//i.test(rawQuery);
    const query = isUrl ? rawQuery : `ytmsearch:${rawQuery}`;
    const voiceChannel = interaction.member.voice.channel;

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = await client.manager.createPlayer({
        guildId: interaction.guild.id,
        voiceId: voiceChannel.id,
        textId: interaction.channel.id,
        deaf: true,
        shardId: interaction.guild.shardId ?? 0,
      });
      player.data.set('textChannel', interaction.channel.id);
    }

    let result;
    try {
      result = await client.manager.search(query, { requester: interaction.user });
    } catch (error) {
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
    }

    if (!result || !result.tracks.length) {
      return interaction.editReply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    if (result.type === 'PLAYLIST') {
      for (const track of result.tracks) {
        player.queue.add(track);
      }
      await interaction.editReply({
        content: `✅ Added **${result.tracks.length}** tracks from **${result.playlistName}** to the queue.`,
      });
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      await interaction.editReply({
        content: `✅ Added **${track.title}** to the queue.`,
      });
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
