import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'discharge-display',
    description: 'Configure what the /deptaction discharge subcommand will display.',
    arguments: [
        new Argument({
            name: 'display',
            type: ArgumentType.STRING,
            required: true,
            description: 'What do you want to display?',
            choices: [
                { name: '{user} has been terminated from the {department_name}', value: 'terminate' },
                { name: '{user} has been discharged from the {department_name}', value: 'discharge' }
            ]
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const display = context.arguments.getString('display')!;
    
        const error = () => context.editReply('I experienced an error while running this command.');
    
        GetGuildData(context.client, context.guild!.id).then(async data => {
            data.config.dischargeDisplay = display;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed('Successfully updated discharge display.') ] });
        }).catch(error);
    }
}