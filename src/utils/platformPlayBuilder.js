const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('./embeds');
const { buildAddedToQueueV2, buildAddedPlaylistV2 } = require('./componentBuilder');
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

      const wasIdle = !player.playing && !player.paused;

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) player.queue.add(track);
        if (!wasIdle) {
          const artUrl = result.tracks[0]?.thumbnail || result.tracks[0]?.artworkUrl;
          const payload = buildAddedPlaylistV2(result.playlistName, result.tracks.length, artUrl);
          await interaction.editReply(payload);
          setTimeout(() => interaction.deleteReply().catch(() => {}), 12000);
          return;
        }
        await interaction.deleteReply().catch(() => {});
      } else {
        const track = result.tracks[0];
        player.queue.add(track);
        if (!wasIdle) {
          const queueSize = player.queue.size;
          const payload = buildAddedToQueueV2(track, queueSize);
          await interaction.editReply(payload);
          setTimeout(() => interaction.deleteReply().catch(() => {}), 12000);
          return;
        }
        await interaction.deleteReply().catch(() => {});
      }

      if (wasIdle) await player.play();
    },
  };
}

module.exports = { buildPlatformPlayCommand };
