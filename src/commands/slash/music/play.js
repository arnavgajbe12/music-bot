const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('../../../utils/embeds');
const { checkVoice } = require('../../../utils/functions');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the queue.')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name, URL, or Spotify link').setRequired(true),
    ),

  async run(client, interaction) {
    await interaction.deferReply();

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const query = interaction.options.getString('query');
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
        embeds: [
          buildEmbed(
            `${config.emojis.success} Added **${result.tracks.length}** tracks from **${result.playlistName}** to the queue.`,
          ),
        ],
      });
    } else {
      const track = result.tracks[0];
      player.queue.add(track);
      if (player.playing || player.paused) {
        await interaction.editReply({
          embeds: [buildEmbed(`${config.emojis.success} Added **[${track.title}](${track.uri})** to the queue.`)],
        });
      } else {
        await interaction.editReply({ embeds: [buildEmbed(`${config.emojis.music} Loading **[${track.title}](${track.uri})**...`)] });
      }
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
