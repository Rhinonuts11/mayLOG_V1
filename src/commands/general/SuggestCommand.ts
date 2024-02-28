import { Command, CommandType } from 'gcommands';
import { GuildTextBasedChannel, Interaction, MessageActionRow, MessageEmbed, Modal, TextInputComponent } from 'discord.js';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import Constants from '../../Constants';

new Command({
    name: 'suggest',
    description: 'Suggest a feature for the bot.',
    type: [ CommandType.SLASH ],
    dmPermission: false,

    async run(context) {
        const uuid = randomUUID();

        const contentComponent = new TextInputComponent()
            .setCustomId('content')
            .setLabel('Suggestion Details')
            .setStyle('PARAGRAPH')
            .setPlaceholder('Please be as detailed in your suggestion as possible.')
            .setMaxLength(1000)
            .setMinLength(10);
        
            const contentRow = new MessageActionRow<TextInputComponent>().addComponents(contentComponent);

        const modal = new Modal()
            .setCustomId(uuid)
            .setTitle('Suggestion')
            .addComponents(contentRow);

        try {
            await context.interaction!.showModal(modal);

            const filter = (interaction: Interaction) => {
                if (!interaction.isModalSubmit()) return false;
                if (interaction.customId !== uuid) return false;
                return interaction.user.id === context.user.id;
            }

            await context.interaction!.awaitModalSubmit({ filter, time: 300000 }).then(async interaction => {
                if (!interaction.isModalSubmit()) return;
                const content = interaction.fields.getTextInputValue('content');

                const logChannel = context.client.guilds.cache.get(Constants.logs.guild_id)?.channels.cache.get(Constants.logs.suggestions) as GuildTextBasedChannel | undefined;
                if (logChannel) {
                    const embed = new MessageEmbed()
                        .setTitle('Suggestion')
                        .setDescription('A new suggestion was received.')
                        .addFields([
                            { name: 'Author', value: `${context.user.username}${context.user.discriminator === '0' ? '' : `#${context.user.discriminator}`} / \`${context.user.id}\`` },
                            { name: 'Suggestion', value: `\`\`\`${content.replace('```', '\`\`\`')}\`\`\``  }
                        ]);
                    logChannel.send({ content: '@everyone', embeds: [ embed ]}).then(() => {
                        interaction.reply({ ephemeral: true, content: 'Suggestion sent.' });
                    }).catch(error => {
                        Sentry.captureException(error);
                        interaction.reply({ ephemeral: true, content: 'Suggestion failed to send.' });
                    })
                } else {
                    interaction.reply({ ephemeral: true, content: 'An error occurred: unable to find log channel.' });
                }
            }).catch(() => {
                context.followUp({ ephemeral: true, content: 'Timed out.' }).catch(() => {});
            });
        } catch {
            context.safeReply({ ephemeral: true, content: 'An error occurred.' });
        }
    }
});