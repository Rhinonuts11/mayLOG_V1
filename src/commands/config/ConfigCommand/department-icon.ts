import { Argument, ArgumentType, CommandContext } from 'gcommands';
import { GetGuildData, SaveGuildData } from '../../../util';
import SuccessEmbed from '../../../util/SuccessEmbed';
import validator from 'validator';

export default {
    name: 'department-icon',
    description: 'Set the department icon to show on department log messages.',
    arguments: [
        new Argument({
            name: 'url',
            description: 'Icon URL. Leave blank to use guild icon.',
            type: ArgumentType.STRING,
            maxLength: 1000
        })
    ],
    run: async (context: CommandContext) => {
        try {
            await context.deferReply({ ephemeral: true });
        } catch {
            return;
        }
        const url = context.arguments.getString('url')!;

        const error = () => context.editReply('I experienced an error while running this command.');
        try {
            if (url !== '' && !validator.isURL(url)) {
                console.log(`Invalid URL Attempt: ${url}`);
                context.editReply('That is not a valid URL');
                return; 
            }
        } catch {
            console.log(`URL validation Catch: $${url}$`);
            context.editReply('That was not a valid URL.');
            return;
        }
        
        GetGuildData(context.client, context.guild!.id).then(async data => {
            const oldURL = data.config.departmentIconURL;
            data.config.departmentIconURL = url || '';
            await SaveGuildData(context.client, context.guild!.id, data).catch(error);
            return context.editReply({ embeds: [ SuccessEmbed(`Successfully updated department icon. Previous link: \`${oldURL}\``) ] });
        }).catch(error);
    }
}