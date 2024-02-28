import { Colors } from '../../../util';
import { CommandContext } from 'gcommands';
import { GuildData } from '../../../global';
import { GuildMember } from 'discord.js';
import { MessageEmbed } from 'gcommands';
import { stripIndents } from 'common-tags';
import * as Sentry from '@sentry/node';
import fetch from 'node-fetch';

interface IData {
    context: CommandContext;
    guild: GuildData;
    embed: MessageEmbed;
    subject?: { username: string, user_id: number, discord_user?: GuildMember };
    extra?: any;
}

interface IFN {
    [key: string]: (data: IData) => any;
}

async function getSubject(data: IData): Promise<GuildMember | void> {
    return new Promise(async (resolve, reject) => {
        try {
            if (data.subject?.discord_user) return resolve(data.subject.discord_user);
            const roverURL = `https://registry.rover.link/api/guilds/${data.context.guild!.id}/roblox-to-discord/${data.subject!.user_id}`;
            const rawResponse = await fetch(roverURL, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ROVER_API_KEY}` }
            });
            const response = await rawResponse.json();
            if (rawResponse.status === 200) {
                if (response.discordUsers.length === 0) {
                    // reject('NOT_FOUND')
                    resolve();
                } else {
                    resolve(data.context.guild!.members.cache.get(response.discordUsers[0].user.id) as GuildMember);
                }
            }
        } catch (error) {
            Sentry.captureException(error);
            resolve();
        }
    });
}

export default <IFN> {
    admin_leave: async (data) => {
        const no_dm = data.context.arguments.getString('no_dm')!;
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.administrativeLeaveRole !== '' && !subject.roles.cache.has(data.guild.config.administrativeLeaveRole)) {
                subject.roles.add(data.guild.config.administrativeLeaveRole)
            }
        }

        if (no_dm !== 'no_dm') {
            const embed = new MessageEmbed()
                .setTitle('Administrative Leave')
                .setColor(Colors.getColor('red'))
                .setDescription(data.guild.config.adminLeaveDM)
                .setFooter({ text: `${data.context.guild!.name}  |  Server ID: ${data.context.guild!.id}`, iconURL: data.context.guild!.iconURL()! });
                if (data.context.arguments.getString('notes')) embed.addFields({ name: 'Notes', value: data.context.arguments.getString('notes')! });
                embed.addFields({
                    name: 'Executor',
                    value: stripIndents`
                        You were placed on Administrative Leave by **${data.extra.executor.username}**.
                        <@${data.context.user.id}> - \`${data.context.user.id}\`
                    `
                });
            if (subject) {
                subject.send({ embeds: [ embed ] }).then(() => {
                    data.context.followUp({ ephemeral: true, content: 'I successully notified the user that they\'ve been placed on administrative leave.' });
                }).catch(() => {
                    data.context.followUp({ ephemeral: true, content: 'I was unable to send the subject a direct message. To avoid legal liability, you should inform them that they are on administrative leave.' });
                });
            } else {
                data.context.followUp({ ephemeral: true, content: 'I was unable to find the subject and DM them. To avoid legal liability, you should inform them that they are on administrative leave.' });
            }
        }
    },
    remove_admin: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.administrativeLeaveRole !== '' && subject.roles.cache.has(data.guild.config.administrativeLeaveRole)) {
                subject.roles.remove(data.guild.config.administrativeLeaveRole)
            }
        }
    },
    suspension: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.suspendedRole !== '' && !subject.roles.cache.has(data.guild.config.suspendedRole)) {
                subject.roles.add(data.guild.config.suspendedRole)
            }
        }
    },
    unsuspend: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.suspendedRole !== '' && subject.roles.cache.has(data.guild.config.suspendedRole)) {
                subject.roles.remove(data.guild.config.suspendedRole)
            }
        }
    },
    probation: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.probationRole !== '' && !subject.roles.cache.has(data.guild.config.probationRole)) {
                subject.roles.add(data.guild.config.probationRole)
            }
        }
    },
    remove_probation: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.probationRole !== '' && subject.roles.cache.has(data.guild.config.probationRole)) {
                subject.roles.remove(data.guild.config.probationRole)
            }
        }
    },
    loa: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.loaRole !== '' && !subject.roles.cache.has(data.guild.config.loaRole)) {
                subject.roles.add(data.guild.config.loaRole)
            }
        }
    },
    remove_loa: async (data) => {
        const subject = await getSubject(data);

        if (subject && data.guild.config.autoRole) {
            if (data.guild.config.loaRole !== '' && subject.roles.cache.has(data.guild.config.loaRole)) {
                subject.roles.remove(data.guild.config.loaRole)
            }
        }
    }
}