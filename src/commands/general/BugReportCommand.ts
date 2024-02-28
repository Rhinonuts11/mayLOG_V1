import { Command, CommandType } from 'gcommands';
import { GuildTextBasedChannel, Interaction, MessageActionRow, MessageEmbed, Modal, TextInputComponent } from 'discord.js';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import Constants from '../../Constants';

new Command({
    name: 'bug_report',
    description: 'Report a bug in the bot.',
    type: [ CommandType.SLASH ],
    dmPermission: false,

    async run(context) {
        const uuid = randomUUID();

        const contentComponent = new TextInputComponent()
            .setCustomId('content')
            .setLabel('Bug details')
            .setStyle('PARAGRAPH')
            .setPlaceholder('Please be as detailed in your report as possible.')
            .setMaxLength(1000)
            .setMinLength(10);
        
        const contentRow = new MessageActionRow<TextInputComponent>().addComponents(contentComponent);
        const modal = new Modal()
            .setCustomId(uuid)
            .setTitle('Bug Report')
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

                const logChannel = context.client.guilds.cache.get(Constants.logs.guild_id)?.channels.cache.get(Constants.logs.bug_reports) as GuildTextBasedChannel | undefined;
                if (logChannel) {
                    const embed = new MessageEmbed()
                        .setTitle('Bug Report')
                        .setDescription('A new bug report was received.')
                        .addFields([
                            { name: 'Author', value: `${context.user.username}${context.user.discriminator === '0' ? '' : `#${context.user.discriminator}`} / \`${context.user.id}\`` },
                            { name: 'Report', value: `\`\`\`${content.replace('```', '\`\`\`')}\`\`\``  }
                        ]);
                    logChannel.send({ content: '@everyone', embeds: [ embed ]}).then(() => {
                        interaction.reply({ ephemeral: true, content: 'Bug report sent.' });
                    }).catch(error => {
                        Sentry.captureException(error);
                        interaction.reply({ ephemeral: true, content: 'Bug report failed to send.' });
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