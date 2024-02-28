import { Argument, ArgumentType, CommandContext } from 'gcommands'
import { GetGuildData, SaveGuildData } from '../../../util';
import Constants from '../../../Constants';
import SuccessEmbed from '../../../util/SuccessEmbed';

function ALMessageChoices() {
    const choices = [];
    const messages = Constants.AdminLeaveMessages;
    for (const key of Object.keys(messages)) {
        choices.push({ name: messages[key as keyof typeof messages], value: key });
    }
    return choices;
}

export default {
    name: 'al-contact-message',
    description: 'Configure the "Contact X and X if seen on team" message',
    arguments: [
        new Argument({
            name: 'message',
            type: ArgumentType.STRING,
            description: 'The message to display when a user is placed on Administrative Leave.',
            choices: ALMessageChoices(),
            required: true
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const message = context.arguments.getString('message')!;
        
        const error = () => context.editReply('An error occurred.');
        GetGuildData(context.client, context.guild!.id).then(async data => {
            data.config.adminLeaveContact = message;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed('Successfully edited administrative leave contact message.') ]});
        }).catch(error);
    }
}