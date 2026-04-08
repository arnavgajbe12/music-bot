const { SlashCommandBuilder } = require('discord.js');
const { buildErrorEmbed } = require('../../../utils/embeds');
const { buildPlayNextConfirmV2, PLAY_NEXT_DELETE_DELAY_MS } = require('../../../utils/componentBuilder');
const { checkVoice } = require('../../../utils/functions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playnext')
    .setDescription('Search for a song and queue it to play immediately after the current track.')
    .addStringOption((option) =>
      option.setName('query').setDescription('Song name or URL').setRequired(true),
    ),

  async run(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceCheck = checkVoice(interaction.member, interaction.guild);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [buildErrorEmbed(voiceCheck.error)] });
    }

    const player = client.manager.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return interaction.editReply({ embeds: [buildErrorEmbed('There is nothing playing right now. Use `/play` to start the queue first.')] });
    }

    const rawQuery = interaction.options.getString('query');
    const isUrl = /^https?:\/\//i.test(rawQuery);
    const query = isUrl ? rawQuery : `ytmsearch:${rawQuery}`;

    let result;
    try {
      // Pass source: '' so Kazagumo does not add its own prefix on top of the one we already set
      result = await client.manager.search(query, { requester: interaction.user, source: '' });
    } catch {
      return interaction.editReply({ embeds: [buildErrorEmbed('Failed to search for that track.')] });
    }

    if (!result || !result.tracks.length) {
      return interaction.editReply({ embeds: [buildErrorEmbed('No results found for that query.')] });
    }

    const track = result.tracks[0];

    // Unshift the track to the very front of the upcoming queue
    player.queue.unshift(track);

    const payload = buildPlayNextConfirmV2(track);
    await interaction.editReply(payload);
    setTimeout(() => interaction.deleteReply().catch(() => {}), PLAY_NEXT_DELETE_DELAY_MS);
  },
};
