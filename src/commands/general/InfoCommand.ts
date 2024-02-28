import { Colors, PrettyMilliseconds } from '../../util';
import { Command, CommandType, MessageEmbed } from 'gcommands';
import { oneLine } from 'common-tags';
import fs from 'fs';

const packageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'));

new Command({
    name: 'info',
    description: 'Show information about the bot.',
    type: [ CommandType.SLASH ],
    dmPermission: false,

    run(context) {
        const embed = new MessageEmbed()
            .setColor(Colors.getColor('mayLOG'))
            .setTitle('mayLOG Information')
            .setDescription(oneLine`
                mayLOG is a Discord bot designed to assist departments with administrative functions, such as
                department actions, activity logs, action requests, and more.`)
            .addFields([
                {
                    name: 'Bot Developer',
                    value: `[DevAX1T](https://www.roblox.com/users/125196014/profile) - \`212772501141323776\``,
                    inline: true
                },
                {
                    name: 'Process Uptime',
                    value: `${PrettyMilliseconds(Math.floor(process.uptime() * 1000), { verbose: true })}`,
                    inline: true
                },
                {
                    name: 'How do I use mayLOG?',
                    value: oneLine`
                    mayLOG has limited availability and isn't available for the general public outside of specific testing periods.
                    The bot was designed for Noahs's State of Mayflower Remade and its affiliated Discord servers. More information can be found in the [documentation](https://hackmd.io/@DevAX1T/HkFI5jDzh).`
                },
                {
                    name: 'Version',
                    value: `\`v${packageJSON.version}\``,
                    inline: true,
                },
                {
                    name: 'Usage/Documentation',
                    value: '[HackMD Documention](https://hackmd.io/@DevAX1T/HkFI5jDzh)',
                    inline: true
                }
            ]);
        context.reply({ embeds: [ embed ] });
    }
});