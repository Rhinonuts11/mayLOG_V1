import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import { stripIndents } from 'common-tags';

const REGEX = /<@&\d+>/g;
const REPLACE_REGEX = /<@&|>/g;

export default {
    name: 'configure-ranks',
    description: 'Configure all department ranks, from lowest to highest.',
    arguments: [
        new Argument({
            name: 'roles',
            description: 'The roles of all ranks, from lowest to highest. Can include acting ranks.',
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
            const oldRanks = data.config.ranks;
            data.config.ranks = roles;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply(stripIndents`
                Successfully updated department ranks.
                \`Old Ranks\`
                > ${oldRanks.length === 0 ? 'None' : oldRanks.map(r => `<@&${r}>`).join(' ')}
                \`New Ranks\`
                > ${roles.length === 0 ? 'None' : roles.map(r => `<@&${r}>`).join(' ')}`);
        }).catch(error);
    }
}