const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('[Dev only] Evaluate JavaScript code.')
    .addStringOption((option) =>
      option.setName('code').setDescription('JavaScript code to evaluate').setRequired(true),
    ),

  async run(client, interaction) {
    if (!config.botSetup.devs.includes(interaction.user.id)) {
      return interaction.reply({
        content: `${config.emojis.error} You do not have permission to use this command.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const code = interaction.options.getString('code');

    try {
      let result = eval(code);
      if (result instanceof Promise) result = await result;

      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      const trimmed = output.length > 1900 ? `${output.slice(0, 1900)}...` : output;

      const embed = new EmbedBuilder()
        .setColor(config.embeds.color)
        .setTitle('✅ Eval Result')
        .addFields(
          { name: 'Input', value: `\`\`\`js\n${code.slice(0, 1000)}\n\`\`\`` },
          { name: 'Output', value: `\`\`\`js\n${trimmed}\n\`\`\`` },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(config.embeds.errorColor)
        .setTitle('❌ Eval Error')
        .addFields(
          { name: 'Input', value: `\`\`\`js\n${code.slice(0, 1000)}\n\`\`\`` },
          { name: 'Error', value: `\`\`\`js\n${String(error).slice(0, 1900)}\n\`\`\`` },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
