import { ActivityLog } from '../../Activity';
import { Argument, ArgumentType, Command, CommandType, MessageActionRow, MessageButton, MessageEmbed } from 'gcommands';
import { Colors, ErrorEmbed, GetGuildData, GetRoVerLink, PrettyMilliseconds, SuccessEmbed } from './../../util';
import { Database } from 'src/global';
import { DateTime } from 'luxon';
import { GuildMember, GuildMemberRoleManager, Interaction, InteractionCollector } from 'discord.js';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { stripIndents } from 'common-tags';
import * as Sentry from '@sentry/node';
import Constants from '../../Constants';
import ActivityAPI from '../../ActivityAPI';
import validator from 'validator';

interface IActivityLog {
    startedMs: number;
    robloxId: number;
    discordId: string;
    team: string;
}

const AGREEMENT_MESSAGE = `
By starting this activity log, you acknowledge that:
- Upon disconnecting from a gameserver, your activity log will be voided if it's less than your quota.
- Your activity log may be voided if you aren't detected to be in-game and on-team for more than 30 seconds.
    - If you serverhop, please do so quickly or your activity log may be voided.
- Your activity log data may not be saved if the bot shuts down unexpectedly.
It is highly recommended that start and end pictures are still taken in the event that you encounter an issue.
`;

new Command({
    name: 'log',
    description: 'Return the ping of the bot.',
    type: [ CommandType.SLASH ],
    dmPermission: false,
    arguments: [
        new Argument({
            name: 'start',
            description: 'Start an activity log.',
            type: ArgumentType.SUB_COMMAND,
        }),
        new Argument({
            name: 'status',
            description: 'Request the status of the current in-game activity log.',
            type: ArgumentType.SUB_COMMAND
        }),
        new Argument({
            name: 'end',
            description: 'End an activity log.',
            type: ArgumentType.SUB_COMMAND
        }),
        new Argument({
            name: 'submit',
            description: 'Submit a manual activity log.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'date',
                    description: 'YYYY-MM-DD format of the log. Converted to UTC by default.',
                    type: ArgumentType.STRING,
                    minLength: 10,
                    maxLength: 10,
                    required: true
                }),
                new Argument({
                    name: 'start_time',
                    description: 'When did this log start? (HH:MM AM/PM)',
                    type: ArgumentType.STRING,
                    required: true
                }),
                new Argument({
                    name: 'start_image',
                    description: 'Please send the screenshot link for the start image.',
                    type: ArgumentType.STRING,
                    maxLength: 250,
                    required: true
                }),
                new Argument({
                    name: 'end_time',
                    description: 'When did this log end? (e.g. HH:MM AM/PM)',
                    type: ArgumentType.STRING,
                    required: true
                }),
                new Argument({
                    name: 'end_image',
                    description: 'Please send the screenshot link for the end image.',
                    type: ArgumentType.STRING,
                    maxLength: 250,
                    required: true
                })
            ]
        }),
        new Argument({
            name: 'info',
            description: 'Retrieve information about an activity log.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'log_id',
                    description: 'What is the ID of the log?',
                    type: ArgumentType.STRING,
                    minLength: 24,
                    maxLength: 24,
                    required: true
                })
            ]
        }),
        new Argument({
            name: 'delete',
            description: 'Delete an activity log.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'log_id',
                    description: 'What is the ID of the log?',
                    type: ArgumentType.STRING,
                    minLength: 24,
                    maxLength: 24,
                    required: true
                }),
                new Argument({
                    name: 'reason',
                    description: 'What is the reason for deleting this log?',
                    type: ArgumentType.STRING
                })
            ]
        })
    ],
    async run(context) {
        const db = context.client.getDatabase<Database>();
        const ActivityManager = db.activityManager;
        try {
            const uuid = randomUUID();
            const subCommand = context.arguments.getSubcommand();
            await context.deferReply({ ephemeral: true })!;
            const RoVerData = await GetRoVerLink(context.guild!.id, context.user.id, db.redis);
            const GuildData = await GetGuildData(context.client, context.guild!.id);
            const quota = ActivityManager.getQuotaForMember(GuildData, await context.guild!.members.fetch(context.user.id)!);
            const embed = new MessageEmbed()
                .setTitle('Activity Logs')
                .setColor(Colors.getColor('mayLOG'));
            const reply = (message: string, isError: boolean = false) => context.editReply({ embeds: [ (isError ? ErrorEmbed : SuccessEmbed)(message) ] });

            if (!quota) return reply('You have no activity quota.', true);
            if (subCommand === 'start') {
                const result = await ActivityAPI.GetPlayerServer(RoVerData.robloxId);
                if (result) {
                    if (result.player.team !== GuildData.config.activityLogs.team) {
                        return context.editReply(`You must be on the \`${GuildData.config.activityLogs.team}\` team to start an activity log.`);
                    }
                    embed
                        .setDescription(AGREEMENT_MESSAGE)
                        .setFooter({ text: `Server Age: ${PrettyMilliseconds(Math.floor(Date.now()) - result!.server.registeredAt)}` });
                    const AcceptButton = new MessageButton()
                        .setCustomId(`accept-${uuid}`)
                        .setLabel('Accept')
                        .setStyle('SUCCESS');
                    const DeclineButton = new MessageButton()
                        .setCustomId(`decline-${uuid}`)
                        .setLabel('Decline')
                        .setStyle('DANGER');
                    const row = new MessageActionRow<MessageButton>().addComponents(AcceptButton, DeclineButton);
                    const message = await context.editReply({ content: 'Please agree to the terms below.', embeds: [embed], components: [ row ] });

                    const filter = (i: Interaction) => {
                        if (!i.isButton()) return false;
                        if (i.message.id !== message.id) return false;
                        if (![ `accept-${uuid}`, `decline-${uuid}`].includes(i.customId)) return false;
                        return i.user.id === context.user.id;
                    }
                    const collector = new InteractionCollector(context.client, { filter, idle: 30000 });
                    const editReply = (message: string | MessageEmbed[], clearEmbeds: boolean = true) => {
                        const messageData: { content?: string | null, components: [], embeds?: [] | MessageEmbed[] } = { components: [] };
                        if (clearEmbeds) messageData.embeds = [];
                        if (typeof message === 'string') {
                            messageData.content = message;
                        } else {
                            messageData.content = null;
                            messageData.embeds = message;
                        }
                        return context.editReply(messageData);
                    }
                    collector.on('collect', async interaction => {
                        collector.stop();
                        if (!interaction.isButton()) return;
                        if (interaction.customId === `decline-${uuid}`) {
                            editReply('Cancelled.')
                            return;
                        }

                        ActivityManager.startIngameLog(context.guild!.id, RoVerData.robloxId, context.user.id).then(() => {
                            const startAtSec = Math.floor(Date.now() / 1000);
                            const startAt = `<t:${startAtSec}:t>`;
                            const endAt = `<t:${Math.floor((Date.now() + quota.time) / 1000)}:t>`;
                            editReply(`Your log started at ${startAt} and can be submitted at ${endAt} (<t:${startAtSec + Math.floor(quota.time / 1000)}:R>)`);
                        }).catch(error => {
                            if (error === 'ONGOING_LOG') {
                                reply('You cannot start a log while one is ongoing', true);
                            } else {
                                Sentry.captureException(error);
                                reply('An error occurred.', true);
                            }
                        });
                    });
                    collector.on('end', interactions => {
                        if (interactions.size === 0) editReply('Cancelled.');
                    });
                } else {
                    context.editReply('You were not found in a server.');
                }
            } else if (subCommand === 'status') {
                ActivityManager.getIngameLogStatus(RoVerData.robloxId).then(log => {
                    if (log) {
                        const startedAt = Math.floor(log.startedAtMs / 1000);
                        embed.addFields([
                            { name: 'Started At', value: `<t:${startedAt}:t> (<t:${startedAt}:R>)` },
                            { name: 'Duration', value: PrettyMilliseconds(log.duration, { verbose: true }) },
                            { name: 'Server Id', value: log.serverId ? `\`${log.serverId}\`` : 'None' }
                        ]);
                        if (!log.serverId) {
                            const expiresAt = `${Math.floor((log.lastKeepAlive + Constants.ActivityLogGracePeriod) / 1000)}`;
                            embed.addFields({ name: 'Ends at', value: `<t:${expiresAt}:t> (<t:${expiresAt}:R>)` });
                        }
                        context.editReply({ embeds: [ embed ] });
                    } else {
                        context.editReply('You have no active activity log.');
                    }
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred.', true);
                });
            } else if (subCommand === 'end') {
                const status = await ActivityManager.getIngameLogStatus(RoVerData.robloxId);
                if (!status) return reply('You have no active log', true);
                const endLog = (noSubmit: boolean = false) => {
                    ActivityManager.endIngameLog(RoVerData.robloxId, status, noSubmit).then(async isDeleted => {
                        if (isDeleted) {
                            try {
                                if (noSubmit) {
                                    context.editReply({ embeds: [], components: [], content: 'Your log was successfully ended. It was not submitted.'});
                                } else {
                                    reply('Your log was successfully ended. A copy of it was sent in your DMs.');
                                }
                            } catch {}
                        } else {
                            reply('You have no active log.', true);
                        }
                    }).catch(error => {
                        Sentry.captureException(error);
                        console.log(error);
                        reply('An error occurred.', true);
                    });
                }
                if (status.duration >= quota.time) {
                    endLog();
                } else {
                    // Add confirmation (button)
                    const ContinueButton = new MessageButton()
                        .setCustomId(`continue-${uuid}`)
                        .setLabel('Continue Log')
                        .setStyle('SUCCESS');
                    const EndButton = new MessageButton()
                        .setCustomId(`end-${uuid}`)
                        .setLabel('End Log')
                        .setStyle('DANGER');
                    const row = new MessageActionRow<MessageButton>().addComponents(ContinueButton, EndButton);
                    const requirement = `Your log duration must be a minimum of \`${PrettyMilliseconds(quota.time, { verbose: true })}\` or else it cannot be submitted.`;
                    const current = `Your current log duration is \`${PrettyMilliseconds(status.duration, { verbose: true } )}\`. Are you sure you want to end your log now?`;
                    const message = await context.editReply({ content: `${requirement} ${current}`, components: [ row ] });
    
                    const filter = (i: Interaction) => {
                        if (!i.isButton()) return false;
                        if (i.message.id !== message.id) return false;
                        if (![ `continue-${uuid}`, `end-${uuid}` ].includes(i.customId)) return false;
                        return i.user.id === context.user.id;
                    }
                    const collector = new InteractionCollector(context.client, { filter, idle: 30000 });
                    const editReply = (message: string | MessageEmbed[], clearEmbeds: boolean = true) => {
                        const messageData: { content?: string | null, components: [], embeds?: [] | MessageEmbed[] } = { components: [] };
                        if (clearEmbeds) messageData.embeds = [];
                        if (typeof message === 'string') {
                            messageData.content = message;
                        } else {
                            messageData.content = null;
                            messageData.embeds = message;
                        }
                        return context.editReply(messageData);
                    }
                    collector.on('collect', async interaction => {
                        collector.stop();
                        if (!interaction.isButton()) return;
                        if (interaction.customId === `continue-${uuid}`) {
                            editReply('Cancelled.');
                            return;
                        }
                        endLog(true);
                        return; 
                    });
                    collector.on('end', interactions => {
                        if (interactions.size === 0) editReply('Cancelled.');
                    });
                }
            } else if (subCommand === 'submit') {
                const date = DateTime.fromISO(context.arguments.getString('date')!);
                const start_time = context.arguments.getString('start_time')!;
                const start_image = context.arguments.getString('start_image')!;
                const end_time = context.arguments.getString('end_time')!;
                const end_image = context.arguments.getString('end_image')!;
                const start = DateTime.fromJSDate(new Date(`${date.toISODate()} ${start_time}`));
                const end = DateTime.fromJSDate(new Date(`${date.toISODate()} ${end_time}`));
                if (!validator.isURL(start_image) || !validator.isURL(end_image)) return context.editReply('You must provide a valid link to the start and end image.');
                function createSubmissionEmbed(): MessageEmbed {
                    return new MessageEmbed()
                        .setTitle('Submission Details')
                        .setColor(Colors.getColor('red'))
                        .setDescription('Here is a copy of your log submission.')
                        .addFields({ name: 'Date', value: `\`${date.toISODate()}\``, inline: true })
                        .addFields({ name: 'Start Time', value: `\`${start_time}\``, inline: true })
                        .addFields({ name: 'End Time', value: `\`${end_time}\``, inline: true })
                        .addFields({ name: 'Start Image', value: start_image })
                        .addFields({ name: 'End Image', value: end_image });
                }

                if (!start.isValid || !end.isValid || !date.isValid) {
                    await reply(stripIndents`
                        An error occurred while trying to parse the date or time. Did you use the correct format?
    
                        The date should be in \`YYYY-MM-DD\` format. (example: \`${DateTime.now().toISODate()}\`)
                        The time should be in HH:MM [AM/PM] format. Here are some examples:
                        > 1:42 PM
                        > 01:42 PM
                        > 01:42
                        > 1:42
                    `, true);
                    return context.followUp({ ephemeral: true, embeds: [ createSubmissionEmbed() ] });
                }

                const logDuration = Math.abs(end.toMillis() - start.toMillis());
                if (!quota) {
                    reply('You do not have an activity quota.', true).then(() => {
                        context.followUp({ ephemeral: true, embeds: [ createSubmissionEmbed() ] });
                    });
                    return;
                }
                if (logDuration < quota.time) {
                    reply(`Your log duration must be a minimum of \`${PrettyMilliseconds(quota.time, { verbose: true })}\` or else it cannot be submitted.`, true).then(() => {
                        context.followUp({ ephemeral: true, embeds: [ createSubmissionEmbed() ] });
                    });
                    return;
                }
                const log = new ActivityLog(context.client, RoVerData.robloxId, context.user!.id)
                    .setStartImage(start_image)
                    .setEndImage(end_image)
                    .setStartMs(Math.floor(start.toMillis()))
                    .setEndMs(Math.floor(end.toMillis()))
                    .setDate(date);
                ActivityManager.submitLog(GuildData, log, RoVerData).then(async ([isDMSuccessful, id]) => {
                    embed
                        .setDescription(`${Constants.emojis.authorized} Your log was submitted successfully.`)
                        .addFields([
                            { name: 'Log ID', value: `\`${id.toString()}\``, inline: true },
                            { name: 'Log Duration', value: PrettyMilliseconds(logDuration, { verbose: true })}
                        ]);
                    try {
                        await context.editReply({ embeds: [ embed ] });
                        if (!isDMSuccessful) {
                            context.followUp({ ephemeral: true, content: 'I failed to DM you a copy of your activity log.' });
                        }
                    } catch {}
                }).catch(async error => {
                    Sentry.captureException(error);
                    await reply('An error occurred while trying to submit your log.', true);
                    context.followUp({ ephemeral: true, embeds: [ createSubmissionEmbed() ] });
                });
            } else if (subCommand === 'info') {
                try {
                    const log_id = context.arguments.getString('log_id')!;
                    if (!ObjectId.isValid(log_id)) return reply('That log ID is invalid.', true);
                    const log = await ActivityManager.fetchLog(new ObjectId(log_id), context.guild!.id);
                    
                    if (log) {
                        const member = context.member! as GuildMember;
                        const isAdmin = member.permissions.has('ADMINISTRATOR');
                        const isCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.commandRoles);
                        const isLogOwner = log.robloxId === RoVerData.robloxId;
                        if (isAdmin || isCommand || isLogOwner) {
                            const embed = await log.toEmbed();
                            context.editReply({ embeds: [ embed] });
                        } else {
                            return reply('That log couldn\'t be found.', true);
                        }
                    } else {
                        reply('That log couldn\'t be found.', true);
                    }
                } catch (error) {
                    Sentry.captureException(error);
                    reply('That log couldn\'t be found.', true);
                }
            } else if (subCommand === 'delete') {
                const log_id = context.arguments.getString('log_id')!;
                const reason = context.arguments.getString('reason');
                if (!ObjectId.isValid(log_id)) return reply('That log ID is invalid.', true);
                try {
                    const log = await ActivityManager.fetchLog(new ObjectId(log_id), context.guild!.id);
                    if (!log) return reply('That log couldn\'t be found.', false);

                    const member = context.member! as GuildMember;
                    const isAdmin = member.permissions.has('ADMINISTRATOR');
                    const isCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.commandRoles);
                    const isLogOwner = log.robloxId === RoVerData.robloxId;

                    if (isAdmin || isCommand || isLogOwner) {
                        await ActivityManager.deleteLog(new ObjectId(log_id), reason);
                        reply('Successfully deleted activity log.');
                    } else {
                        return reply('That log couldn\'t be found.', false);
                    }
                } catch (error) {
                    Sentry.captureException(error);
                    reply('An error occurred.', true);
                }
            }
        } catch (error) {
            console.log(error);
            context.safeReply({ ephemeral: true, content: 'An error occurred. '});
        }
        return;
    },
});