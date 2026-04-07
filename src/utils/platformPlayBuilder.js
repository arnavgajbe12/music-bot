const { SlashCommandBuilder } = require('discord.js');
const { buildEmbed, buildErrorEmbed } = require('./embeds');
const { checkVoice } = require('./functions');

/**
 * Build a platform-specific play command.
 * @param {string} name - Slash command name (e.g. 'yt')
 * @param {string} description - Human-readable description
 * @param {string} searchPrefix - Kazagumo/LavaSrc search prefix (e.g. 'ytsearch:')
 * @param {string} platformLabel - Display label (e.g. 'YouTube')
 */
function buildPlatformPlayCommand(name, description, searchPrefix, platformLabel) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addStringOption((opt) =>
        opt.setName('query').setDescription(`Song name to search on ${platformLabel}`).setRequired(true),
      ),

    async run(client, interaction) {
      await interaction.deferReply({ ephemeral: true });

      const voiceCheck = checkVoice(interaction.member, interaction.guild);
      if (!voiceCheck.ok) {
        return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
      }

      const rawQuery = interaction.options.getString('query');
      const isUrl = /^https?:\/\//i.test(rawQuery);
      const query = isUrl ? rawQuery : `${searchPrefix}${rawQuery}`;
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
      } catch {
        return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
      }

      if (!result || !result.tracks.length) {
        return interaction.editReply({ embeds: [buildErrorEmbed(`No results found on ${platformLabel}.`)] });
      }

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) player.queue.add(track);
        await interaction.editReply({
          embeds: [buildEmbed(`✅ Added **${result.tracks.length}** tracks from **${result.playlistName}** to the queue.`)],
        });
      } else {
        const track = result.tracks[0];
        player.queue.add(track);
        await interaction.editReply({
          embeds: [buildEmbed(`✅ Added **${track.title}** to the queue via ${platformLabel}.`)],
        });
      }

      if (!player.playing && !player.paused) await player.play();
    },
  };
}

module.exports = { buildPlatformPlayCommand };
