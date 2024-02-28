import { Argument, ArgumentChoice, ArgumentType, Command, CommandType, MessageEmbed } from 'gcommands';
import { Colors, ErrorEmbed, GetGuildData, PrettyMilliseconds, SaveGuildData, SuccessEmbed } from './../../util';
import { Database } from 'src/global';
import { DateTime } from 'luxon';
import * as Sentry from '@sentry/node';
import Constants from '../../Constants';
import { GuildMember, GuildMemberRoleManager } from 'discord.js';

function getTeamChoices(): ArgumentChoice[] {
    return Constants.GameTeams.map(m => {
        return { name: m, value: m };
    });
}

// todo: fix THREAD BREAKING
// possibly because of the LIBRARY not handling threads (look for gcommands update)

new Command({
    name: 'cycle',
    description: 'Modify the patrol cycle for the department.',
    type: [ CommandType.SLASH ],
    dmPermission: false,
    arguments: [
        new Argument({
            name: 'info',
            description: 'Get information for the current activity cycle.',
            type: ArgumentType.SUB_COMMAND
        }),
        new Argument({
            name: 'set',
            description: 'Set the activity cycle.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'start_date',
                    description: 'Use YYYY-MM-DD for the start date.',
                    type: ArgumentType.STRING,
                    required: true
                }),
                new Argument({
                    name: 'end_date',
                    description: 'Use YYYY-MM-DD for the end date.',
                    type: ArgumentType.STRING,
                    required: true
                }),
                new Argument({
                    name: 'team',
                    description: 'What team is required to be used? Exact name.',
                    type: ArgumentType.STRING,
                    choices: getTeamChoices()
                })
            ]
        }),
        new Argument({
            name: 'enable',
            description: 'Enable or disable global activity quotas.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'status',
                    description: 'The status of activity quotas.',
                    type: ArgumentType.STRING,
                    choices: [
                        { name: 'Enabled', value: 'enabled' },
                        { name: 'Disabled', value: 'disabled' }
                    ]
                })
            ]
        }),
        new Argument({
            name: 'skip',
            description: 'Skip this activity cycle.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'status',
                    description: 'Whether the activity cycle will be skipped or not.',
                    type: ArgumentType.BOOLEAN,
                    required: true
                })
            ]
        }),
        new Argument({
            name: 'excuse',
            description: 'Excuse a user from activity cycle.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'subject',
                    description: 'The subject excuse from the activity cycle.',
                    type: ArgumentType.USER,
                    required: true
                }),
                new Argument({ // todo: Show "Excused [I]" and "Excused [C]"; Excused [Individual]; Excused [Cycle]
                    name: 'status',
                    description: 'Whether the activity cycle will be excused or not.',
                    type: ArgumentType.BOOLEAN,
                    required: true
                })
            ]
        })
    ],
    async run(context) {
        const subCommand = context.arguments.getSubcommand();
        await context.deferReply({ ephemeral: true });
        try {
            const db = context.client.getDatabase<Database>();
            const GuildData = await GetGuildData(context.client, context.guild!.id);
            const activity = GuildData.config.activityLogs;
            if (!activity.accessEnabled) return context.editReply('You cannot use this command.');
            const embed = new MessageEmbed()
                .setTitle('Activity Logs')
                .setColor(Colors.getColor('mayLOG'));
            const reply = (message: string, isError: boolean = false) => context.editReply({ embeds: [ (isError ? ErrorEmbed : SuccessEmbed)(message) ] });
            const isAdmin = (context.member! as GuildMember).permissions.has('ADMINISTRATOR');
            const isDepartmentCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.departmentCommandRoles);
            const isCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.commandRoles);

            if (subCommand === 'set') {
                if (!activity.enabled) return context.editReply('Activity quotas are disabled.');
                if (!isAdmin || !isDepartmentCommand) return context.editReply('You must be a department command member to use this command.');
                const start_date = DateTime.fromISO(context.arguments.getString('start_date')!).toUTC();
                const end_date = DateTime.fromISO(context.arguments.getString('end_date')!).toUTC();
                const team = context.arguments.getString('team');
    
                if (!start_date.isValid) return context.reply({ ephemeral: true, content: 'The start date must be in valid ISO8601 format.' });
                if (!end_date.isValid) return context.reply({ ephemeral: true, content: 'The end date must be in valid ISO8601 format.' });
    
                if (activity.cycle.duration === 0) {
                    embed.setDescription('There is no current cycle.');
                } else {
                    const currentCycleStart = (activity.cycle.cycleEndMs - activity.cycle.duration) / 1000;
                    const currentCycleEnd = activity.cycle.cycleEndMs / 1000;
                    embed.setDescription(`<t:${currentCycleStart}:F> - <t:${currentCycleEnd}:F> (\`${PrettyMilliseconds(activity.cycle.duration, { verbose: true })}\`)`);
                }

                // todo: in the future, make sure that CURRENT users dont show up in PAST activity logs, because what if they werent in the dept at the time?
                // so, store their roles at the time and see if they are/were in the current unit
                //> i can probably just store the cycleEnd to filter out who participated in the cycle (also store roles!)

                const cycleStart = start_date.toMillis();
                const cycleEnd = end_date.toMillis();
                const cycleDuration = cycleEnd - cycleStart;
                if (cycleStart === cycleEnd) return context.editReply('The start and end date must be different.');
                if (Date.now() > cycleEnd) return context.editReply('The end date must be in the future.');
    
                activity.cycle.duration = cycleDuration;
                activity.cycle.cycleEndMs = cycleEnd;
                if (team && team !== 'None') {
                    activity.team = team;
                    embed.addFields({ name: 'New Team', value: `\`${team}\`` });
                }
    
                embed.addFields({
                    name: 'New Configuration', 
                    value: `<t:${cycleStart / 1000}:F> - <t:${cycleEnd / 1000 }:F> (\`${PrettyMilliseconds(cycleDuration, { verbose: true })}\`)`
                });
    
                try {
                    await SaveGuildData(context.client, context.guild!.id, GuildData);
                } catch (error) {
                    Sentry.captureException(error);
                    return context.editReply('Sorry! An error occurred and I was unable to save the cycle data.');
                }

                context.editReply({ embeds: [ embed ] });
            } else if (subCommand === 'info') {
                if (!activity.enabled) return context.editReply('Activity quotas are disabled.');
                if (!isAdmin && !isCommand) return context.editReply('You must be a department command member to use this command.');
                const cycleStart = DateTime.fromMillis(activity.cycle.cycleEndMs - activity.cycle.duration);
                const cycleEnd = DateTime.fromMillis(activity.cycle.cycleEndMs);

                embed
                    .setDescription('The information for the current cycle can be found below.')
                    .addFields([
                        { name: 'Cycle Start', value: `<t:${cycleStart.toSeconds()}:F>`, inline: true },
                        { name: 'Cycle End', value: `<t:${cycleEnd.toSeconds()}:F>`, inline: true },
                        { name: 'Cycle Duration', value: PrettyMilliseconds(activity.cycle.duration, { verbose: true }), inline: true },
                        { name: 'Team', value: `\`${activity.team}\`` || 'None'}
                    ]);
                context.editReply({ embeds: [ embed ] });
            } else if (subCommand === 'enable') {
                if (!isAdmin && !isDepartmentCommand) return context.editReply('You must be a department command member to use this command.');
                const status = context.arguments.getString('status')!;
                const statusBoolean = status === 'enabled';
                activity.enabled = statusBoolean;

                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                    reply(`Successfully **${status}** activity quotas.`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                });
            } else if (subCommand === 'skip') {
                if (!activity.enabled) return context.editReply('Activity quotas are disabled.');
                if (!isAdmin && !isDepartmentCommand) return context.editReply('You must be a department command member to use this command.');
                const status = context.arguments.getBoolean('status')!;
                activity.cycle.isSkipped = status;

                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                   reply(`Successfully **${status ? 'skipped' : 'unskipped'}** the current activity log cycle.`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                });
            } else if (subCommand === 'excuse') {
                if (!activity.enabled) return context.editReply('Activity quotas are disabled.');
                if (!isAdmin && !isCommand) return context.editReply('You must be a command member to use this command.');
                const subject = context.arguments.getUser('subject')!;
                const isSkipped = context.arguments.getBoolean('status')!;
                const collection = db.mongo.db('maylog').collection('skipped_users');
                async function doesUserExist(): Promise<boolean> {
                    return new Promise((resolve, reject) => {
                        collection.findOne({ userId: subject.id, guildId: context.guild!.id, cycle: `${activity.cycle.duration}-${activity.cycle.cycleEndMs}` }).then(user => {
                            console.log(user)
                            resolve(!!user);
                        }).catch(error => {
                            Sentry.captureException(error);
                            reject(error);
                        });
                    });
                }

                const dataTable = {
                    ttl: new Date(),
                    guildId: context.guild!.id,
                    userId: context.user!.id,
                    cycle: `${activity.cycle.duration}-${activity.cycle.cycleEndMs}`
                }
   
                const isExistent = await doesUserExist();
                console.log(isExistent)
                if (isExistent && isSkipped) return reply('This user was already excused for this cycle.', true);
                if (!isExistent && !isSkipped) return reply('This user is not excused for this cycle.', true);

                if (isSkipped) {
                    if (isExistent) {
                        collection.replaceOne({ userId: subject.id, guildId: context.guild!.id }, dataTable).then(() => {
                            return reply('Successfully skipped activity cycle.R');
                        }).catch(error => {
                            Sentry.captureException(error);
                            return reply('An error occurred', true);
                        });
                    } else {
                        collection.insertOne(dataTable).then(() => {
                            return reply('Successfully skipped activity cycle.');
                        }).catch(error => {
                            Sentry.captureException(error);
                            return reply('An error occurred', true);
                        });
                    }
                } else {
                    collection.deleteOne({ userId: subject.id, guildId: context.guild!.id, cycle: `${activity.cycle.duration}-${activity.cycle.cycleEndMs}` }).then(doc => {
                        return reply('Successfully un-skipped activity cycle.');
                    }).catch(error => {
                        Sentry.captureException(error);
                        return reply('An error occurred', true);
                    });
                }
            }
        } catch (error) {
            Sentry.captureException(error);
            return context.safeReply({ ephemeral: true, content: 'Sorry! An error occurred. '});
        }
    },
});