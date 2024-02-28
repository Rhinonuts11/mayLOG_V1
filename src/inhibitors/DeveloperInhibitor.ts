import { CommandContext, Inhibitor } from 'gcommands';
import { InhibitorOptions } from 'gcommands/dist/inhibitors';
import Constants from '../Constants';

export = class DeveloperInhibitor extends Inhibitor.Inhibitor {
    constructor(options?: InhibitorOptions) {
        super(options);
    }
    async run(context: CommandContext) {
        try {
            if (Constants.developerIds.includes(context.user.id)) return true;
            return context.safeReply({ ephemeral: true, content: 'You must be a bot developer to use this command.' });
        } catch {
            return context.safeReply({ ephemeral: true, content: 'An error occurred.' });
        }
    }
}