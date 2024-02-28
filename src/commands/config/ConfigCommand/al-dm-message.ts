import { CommandContext } from 'gcommands';
import { Database } from 'src/global';
import { GetGuildData, GetRoVerLink, SaveGuildData } from '../../../util';
import { Interaction, InteractionCollector, MessageActionRow, MessageButton, MessageEmbed, Modal, TextInputComponent } from 'discord.js';
import { randomUUID } from 'crypto';
import { stripIndents } from 'common-tags';
import Constants from '../../../Constants';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'al-dm-message',
    description: 'Configure what message is sent to a user when placed on administrative leave.',
    run: async (context: CommandContext) => {
        const uuid = randomUUID();
        const contentComponent = new TextInputComponent()
            .setCustomId('content')
            .setLabel('Message content')
            .setStyle('PARAGRAPH')
            .setPlaceholder('Content, or use "default" to reset message')
            .setMinLength(7)
            .setMaxLength(1024);
        
        const contentRow = new MessageActionRow<TextInputComponent>().addComponents(contentComponent);
        
        const modal = new Modal()
            .setCustomId(uuid)
            .setTitle('Configuration')
            .addComponents(contentRow);
        
        await context.interaction!.showModal(modal);
        
        const filter = (interaction: Interaction) => {
            if (!interaction.isModalSubmit()) return false;
            if (interaction.customId !== uuid) return false;
            return interaction.user.id === context.user.id;
        }
        
        await context.interaction!.awaitModalSubmit({ filter, time: 300000 }).then(async interaction => {
            if (!interaction.isModalSubmit()) return;
            const content = interaction.fields.getTextInputValue('content');
            const roverData = await GetRoVerLink(interaction.guild!.id, interaction.user.id, context.client.getDatabase<Database>().redis)
        
            try {
                const embed = new MessageEmbed()
                    .setTitle('Administrative Leave')
                    .setColor('RED')
                    .setDescription(content.toLowerCase() === 'default' ? Constants.BlankGuild.config.adminLeaveDM : content)
                    .setFooter({ text: context.guild!.name, iconURL: context.guild!.iconURL()! })
                    .addFields([
                        {
                            name: 'Executor',
                            value: stripIndents`
                                You were placed on administrative leave by **${roverData.cachedUsername}**.
                                <@${interaction.user.id}> - \`${interaction.user.id}\`
                            `
                        }
                    ]);    
                
                const SubmitButton = new MessageButton()
                    .setCustomId(`submit-${uuid}`)
                    .setLabel('Submit')
                    .setStyle('SUCCESS');
                const CancelButton = new MessageButton()
                    .setCustomId(`cancel-${uuid}`)
                    .setLabel('Cancel')
                    .setStyle('DANGER');

                const row = new MessageActionRow<MessageButton>().addComponents(SubmitButton, CancelButton);
        
                interaction.reply({ ephemeral: true, content: 'Please confirm this is correct', embeds: [ embed ], components: [ row ] });
                const editReply = (message: string) => interaction.editReply({ content: message, embeds: [], components: []});
                const filter = (i: Interaction) => {
                    if (!i.isButton()) return false;
                    if (![ `submit-${uuid}`, `cancel-${uuid}` ].includes(i.customId)) return false;
                    if (i.channel!.id !== context.channel!.id) return false;
                    return i.user.id === context.user.id;
                }
        
                const collector = new InteractionCollector(context.client, { filter, idle: 300000 });
                collector.on('collect', button => {
                    collector.stop();
                    if (!button.isButton()) return;
                    if (button.customId === `cancel-${uuid}`) {
                        editReply('Cancelled.');
                        return
                    }
                    GetGuildData(context.client, context.guild!.id).then(async data => {
                        data.config.adminLeaveDM = content.toLowerCase() === 'default' ? Constants.BlankGuild.config.adminLeaveDM : content;
            
                        SaveGuildData(context.client, context.guild!.id, data).then(() => {
                            interaction.editReply({ embeds: [ SuccessEmbed('Successfully configured administrative leave direct message.') ] });
                        }).catch(() => editReply('An error occurred'));
                    }).catch(() => editReply('An error occurred.'));
                });
                collector.on('end', interactions => {
                    if (interactions.size === 0) editReply('Cancelled.');
                });
            } catch {
                const msg = 'An error occurred';
                if (interaction.replied) {
                    interaction.editReply(msg)
                } else {
                    interaction.reply(msg);
                }
            }
        }).catch(() => {
            try {
                context.followUp({ ephemeral: true, content: 'Timed out.' });
            } catch {}
        });
    }
}