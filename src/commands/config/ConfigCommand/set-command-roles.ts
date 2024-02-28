
import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';

const REGEX = /<@&\d+>/g;
const REPLACE_REGEX = /<@&|>/g;

export default {
    name: 'set-command-roles',
    description: 'Set roles that have access to use log commands.',
    arguments: <Argument[]>[
        new Argument({
            name: 'roles',
            description: 'The roles that have access to use mayLOG',
            type: ArgumentType.STRING,
            required: true
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const matchedRoles = context.arguments.getString('roles')!.match(REGEX);
        if (!matchedRoles) return;
        
        const roles = matchedRoles.map(id => id.replace(REPLACE_REGEX, ''));
        const error = () => context.editReply('I experienced an error while running this command.');
        
        GetGuildData(context.client, context.guild!.id).then(async data => {
            const oldRoles = data.config.commandRoles;
            data.config.commandRoles = roles;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            const successEmbed = SuccessEmbed('Successfully updated `command` roles.')
                .addFields({ name: 'Old Ranks', value: oldRoles.length === 0 ? 'None' : oldRoles.map(r => `<@&${r}>`).join(' ') })
                .addFields({ name: 'New Ranks', value: roles.length === 0 ? 'None' : roles.map(r => `<@&${r}>`).join(' ')});
            return context.editReply({ embeds: [ successEmbed ] });
        }).catch(error);
    }

}