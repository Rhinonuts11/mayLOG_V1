import { CommandContext, Inhibitor } from 'gcommands';
import { GetGuildData } from '../util';
import { InhibitorOptions } from 'gcommands/dist/inhibitors';
import Constants from '../Constants';

export = class DepartmentCommandInhibitor extends Inhibitor.Inhibitor {
    constructor(options?: InhibitorOptions) {
        super(options);
    }
    async run(context: CommandContext) {
        if (!context.guild) {
            return context.safeReply('You can\'t run commands in DMs.');
        }

        if (Constants.developerIds.includes(context.user.id)) return true;
        try {
            const guild = await GetGuildData(context.client, context.guild.id);
            const member = context.guild.members.cache.get(context.user.id)!;
            if (member.roles.cache.hasAny(...guild.config.departmentCommandRoles)) return true;
            if (member.permissions.has('ADMINISTRATOR')) return true;
            return context.safeReply({ ephemeral: true, content: 'You must be a high command member to use this command.' });
        } catch {
            return context.safeReply({ ephemeral: true, content: 'An error occurred.' });
        }
    }
}