import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import { TextChannel } from 'discord.js';
import Constants from '../../../Constants';
import SuccessEmbed from '../../../util/SuccessEmbed';

export default {
    name: 'set-actionreq-channel',
    description: 'Set the action request channel to be used.',
    arguments: [
        new Argument({
            name: 'channel',
            description: 'The channel to set. Leave blank to reset.',
            type: ArgumentType.CHANNEL
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const channel = context.arguments.getChannel('channel');
        const error = () => context.editReply('I experienced an error while running this command.');

        if (channel && !(channel instanceof TextChannel)) {
            return context.editReply('You must set a proper **text channel** as your log channel.');
        }
        
        return GetGuildData(context.client, context.guild!.id).then(async data => {
            data.config.actionRequestChannel = channel ? channel.id : Constants.BlankGuild.config.actionRequestChannel;
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed('Successfully updated action request channel.') ] });
        }).catch(error);
    }
}