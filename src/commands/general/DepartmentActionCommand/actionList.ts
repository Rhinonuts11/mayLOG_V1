import { Colors } from '../../../util';
import { DateTime } from 'luxon';
import { GuildData } from '../../../global';
import { oneLine, stripIndents } from 'common-tags';
import Constants from '../../../Constants';
import { CommandContext, MessageEmbed } from 'gcommands';
import { ColorResolvable } from 'discord.js';

interface IFN {
    [key: string]: (data: {
        context: CommandContext;
        guild: GuildData;
        embed: MessageEmbed;
        subject?: { username: string, user_id: number }
    }) => void;
}

class DateError extends Error {
    constructor() {
        super('$$Please use the `YYYY-MM-DD` format for dates.');
    }
}

export default <IFN>{
    accept: (data) => {
        const { embed, subject, context } = data;
        embed
            .setColor(Colors.getColor('green'))
            .setDescription(`**${subject!.username}** has been **accepted** into the **${context.guild!.name}**.`);
    },
    admin_leave: (data) => {
        const { embed, subject, guild } = data;
        embed
            .setColor(Colors.getColor('deepOrange'))
            .setDescription(stripIndents`
                **${subject!.username}** has been placed on **administrative leave**.

                ${Constants.AdminLeaveMessages[guild.config.adminLeaveContact as keyof typeof Constants.AdminLeaveMessages]}
            `);
    },
    remove_admin: (data) => {
        const { embed, subject } = data;
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** is no longer on **administrative leave**.`);  
    },
    probation: (data) => {
        const { embed, subject, context } = data;
        const expirationMs = DateTime.fromISO(context.arguments.getString('expiration')!).toUTC().toSeconds();
        if (isNaN(expirationMs)) throw new DateError();
        
        embed
            .setColor('#01885b')
            .setDescription(`**${subject!.username}** is now on **probation** until <t:${expirationMs}:D>.`);
    },
    remove_probation: (data) => {
        const { embed, subject } = data;
        
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** is no longer on **probation**.`);
    },
    verbal_warning: (data) => {
        const { embed, subject } = data;
        embed
            .setColor(Colors.getColor('deepOrange'))
            .setDescription(`**${subject!.username}** has received a **verbal warning**.`);
    },
    recorded_warning: (data) => {
        const { embed, subject } = data;
        embed
            .setColor(Colors.getColor('deepOrange'))
            .setDescription(`**${subject!.username}** has received a **recorded warning**.`);
    },
    suspension: (data) => {
        const { embed, subject, context } = data;
        const expirationMs = DateTime.fromISO(context.arguments.getString('expiration')!).toUTC().toSeconds();
        if (isNaN(expirationMs)) throw new DateError();
        embed
            .setColor(Colors.getColor('deepOrange'))
            .setDescription(`**${subject!.username}** has been **suspended** until <t:${expirationMs}:D>.`);
    },
    unsuspend: (data) => {
        const { embed, subject } = data;
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** has been **unsuspended**.`);
    },
    transfer: (data) => {
        const { embed, subject, context } = data;
        const division = context.arguments.getRole('division')!.name;
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** has been **transferred** to **${division}**.`);
    },
    transfer_promote: (data) => {
        const { embed, subject, context } = data;
        const rank = context.arguments.getRole('rank')!.name;
        const division = context.arguments.getRole('division')!.name;
        embed
            .setColor(Colors.getColor('green'))
            .setDescription(`**${subject!.username}** has been **promoted** to **${rank}** and **transferred** to **${division}**.`)
    },
    transfer_demote: (data) => {
        const { embed, subject, context } = data;
        const rank = context.arguments.getRole('rank')!.name;
        const division = context.arguments.getRole('division')!.name;
        embed
            .setColor(Colors.getColor('red'))
            .setDescription(`**${subject!.username}** has been **demoted** to **${rank}** and **transferred** to **${division}**.`)
    },
    promote: (data) => {
        const { embed, subject, context } = data;
        const rank = context.arguments.getRole('rank')!.name;
        const division = context.arguments.getRole('division')?.name;
        embed
            .setColor(Colors.getColor('green'))
            .setDescription(`**${subject!.username}** has been **promoted** to **${rank}**${ division ? ` within **${division}**` : ''}.`);
    },
    demote: (data) => {
        const { embed, subject, context } = data;
        const rank = context.arguments.getRole('rank')!.name;
        const division = context.arguments.getRole('division')?.name;
        embed
            .setColor(Colors.getColor('red'))
            .setDescription(`**${subject!.username}** has been **demoted** to **${rank}**${ division ? ` within **${division}**` : ''}.`);
    },
    discharge: (data) => {
        const { embed, subject, context, guild } = data;
        const type = context.arguments.getString('type')! as 'honorable' | 'dishonorable' | 'general' | 'preliminary';

        type dischargeDetails = { been?: boolean; text: string, guildName?: boolean }
        const options: { [key: string]: {
            color: ColorResolvable;
            discharge: dischargeDetails;
            standard?: dischargeDetails;
        }} = {
            dishonorable: {
                color: Colors.getColor('red'),
                discharge: { been: true, text: 'dishonorably' },
                standard:  { been: true, text: 'terminated', guildName: true }
            },
            honorable: {
                color: Colors.getColor('yellow'),
                discharge: { been: true, text: 'honorably' },
                standard:  { been: false, text: 'resigned', guildName: true }
            },
            general: {
                color: Colors.getColor('yellow'),
                discharge: { been: true, text: 'generally' }
            },
            preliminary: {
                color: Colors.getColor('yellow'),
                discharge: { been: true, text: 'preliminarily' }
            }
        }
        const isDischargeDisplay = guild.config.dischargeDisplay === 'discharge';
        const standardOptions = [];
        for (const name of Object.keys(options)) {
            if (options[name].standard) standardOptions.push(`\`${name}\``);
        }
        if (!options[type].standard && !isDischargeDisplay) {
            throw new Error(oneLine`$$An error occurred while attempting to execute this command. \`DischargeDisplay\` is not set to \`discharge\`.
            Until this is changed, you may only use the following discharge types: ${ standardOptions.join(', ') }.`);
        }
        const option = options[type];
        const details = isDischargeDisplay ? option.discharge : option.standard!;
        const text = `has ${details.been ? 'been ' : ''}**${details.text}**${isDischargeDisplay ? ' discharged' : ''}${details.guildName ? ` from the **${context.guild!.name}**` : ''}`;

        embed
            .setColor(option.color)
            .setDescription(`**${subject!.username}** ${text}.`);
    },
    blacklist: (data) => {
        const { embed, subject, context } = data;
        const type = context.arguments.getString('type')! as 'permanent' | 'temporary' | 'general';

        let displayMessage;
        if (type === 'permanent') {
            displayMessage = 'permanently';
        } else if (type === 'temporary') displayMessage = 'temporarily';

        embed
            .setColor(Colors.getColor('black'))
            .setDescription(`**${subject!.username}** has been **${displayMessage ? ` ${displayMessage} ` : ''} blacklisted**.`);
    },
    loa: (data) => {
        const { embed, subject, context } = data;
        const expirationMs = DateTime.fromISO(context.arguments.getString('expiration')!).toUTC().toSeconds();
        if (isNaN(expirationMs)) throw new DateError();
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** is now on a **leave of absence** until <t:${expirationMs}:D>.`);
    },
    remove_loa: (data) => {
        const { embed, subject } = data;
        embed
            .setColor(Colors.getColor('steelBlue'))
            .setDescription(`**${subject!.username}** is no longer on a **leave of absence**.`);
    },
    custom: (data) => {
        const { embed, context } = data;
        const message = context.arguments.getString('message')!;
        const hexColor = context.arguments.getString('hex_color');
        const presetColor = context.arguments.getString('preset_color');
        const color = (hexColor ?? presetColor)!
        if (!color) throw new Error('$$You must select `hex_color` or `preset_color`.');

        embed.setDescription(message).setColor(Colors.determineColor(color) as ColorResolvable);
    }
}