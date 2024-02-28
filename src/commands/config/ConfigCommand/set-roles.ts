import { Argument, ArgumentType, CommandContext } from 'gcommands'
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'set-roles',
    description: 'Configure the LOA and administrative leave role.',
    arguments: [
        new Argument({
            name: 'auto_role',
            type: ArgumentType.BOOLEAN,
            description: 'Whether to automatically give/remove these roles in appropriate situations.',
            required: true
        }),
        new Argument({
            name: 'admin_leave_role',
            type: ArgumentType.ROLE,
            description: 'The role to give when a user is placed on Administrative Leave. Leave blank to reset.',
        }),
        new Argument({
            name: 'suspended_role',
            type: ArgumentType.ROLE,
            description: 'The role to give when a user is suspended.'
        }),
        new Argument({
            name: 'probation_role',
            type: ArgumentType.ROLE,
            description: 'The role to give to a user when they\'re placed on probation.'
        }),
        new Argument({
            name: 'loa_role',
            type: ArgumentType.ROLE,
            description: 'The role to give when a user is placed on a leave of absence. Leave blank to reset.'
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const auto_role = context.arguments.getBoolean('auto_role')!;
        const admin_leave_role = context.arguments.getRole('admin_leave_role');
        const suspended_role = context.arguments.getRole('suspended_role');
        const probation_role = context.arguments.getRole('probation_role');
        const loa_role = context.arguments.getRole('loa_role');
        const error = () => context.editReply('An error occurred.');

        GetGuildData(context.client, context.guild!.id).then(async data => {
            const c = data.config;
            c.autoRole = auto_role;
            if (admin_leave_role) c.administrativeLeaveRole = admin_leave_role.id; else c.administrativeLeaveRole = '';
            if (suspended_role) c.suspendedRole = suspended_role.id; else c.suspendedRole = '';
            if (probation_role) c.probationRole = probation_role.id; else c.probationRole = '';
            if (loa_role) c.loaRole = loa_role.id; else c.loaRole = '';

            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed('Successfully edited guild roles.') ]});
        }).catch(error);
    }
}