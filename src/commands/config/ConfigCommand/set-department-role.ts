import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'set-department-role',
    description: 'Set the department role that can run lower-level commands.',
    arguments: <Argument[]>[
        new Argument({
            name: 'role',
            description: 'Set the department role.',
            type: ArgumentType.ROLE,
            required: true
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const departmentRole = context.arguments.getRole('role')!;
        const error = () => context.editReply('I experienced an error while running this command.');
        
        GetGuildData(context.client, context.guild!.id).then(async data => {
            const oldRole = data.config.departmentRole;
            data.config.departmentRole = departmentRole.id;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            const successEmbed = SuccessEmbed('Successfully updated department role.')
                .addFields({ name: 'Old Role', value: oldRole ? `<@&${oldRole}>` : `None`})
                .addFields({ name: 'New Role', value: `<@&${departmentRole.id}>`});
            return context.editReply({ embeds: [ successEmbed ] });
        }).catch(error);
    }
}