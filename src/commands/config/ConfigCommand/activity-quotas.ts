import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'activity-quotas',
    description: 'Configure if the guild uses activity quotas or not.',
    arguments: [
        new Argument({
            name: 'status',
            description: 'Whether to enable or disable this feature',
            type: ArgumentType.STRING,
            required: true,
            choices: [
                { name: 'Enabled', value: 'enabled' },
                { name: 'Disabled', value: 'disabled' }
            ]
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const status = context.arguments.getString('status')!;
        const error = () => context.editReply('I experienced an error while running this command.');

        GetGuildData(context.client, context.guild!.id).then(async data => {
            if (!data.config.activityLogs.accessEnabled) return context.editReply('This server is not allowed to use activity quotas.');
            data.config.activityLogs.enabled = status === 'enabled' ? true : false
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed(`Successfully **${status}** the \`Activity Quota\` setting.`) ] });
        }).catch(error);
    }
}