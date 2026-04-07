const { EmbedBuilder } = require('discord.js');
const config = require('../../../../config');

module.exports = {
  name: 'eval',
  aliases: ['ev'],
  description: '[Dev only] Evaluate JavaScript code.',
  usage: '<code>',

  async run(client, message, args) {
    if (!config.botSetup.devs.includes(message.author.id)) {
      return message.reply({ content: `${config.emojis.error} You do not have permission to use this command.` });
    }

    if (!args.length) {
      return message.reply({ content: `${config.emojis.error} Please provide code to evaluate.` });
    }

    const code = args.join(' ');

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

      return message.reply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(config.embeds.errorColor)
        .setTitle('❌ Eval Error')
        .addFields(
          { name: 'Input', value: `\`\`\`js\n${code.slice(0, 1000)}\n\`\`\`` },
          { name: 'Error', value: `\`\`\`js\n${String(error).slice(0, 1900)}\n\`\`\`` },
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
