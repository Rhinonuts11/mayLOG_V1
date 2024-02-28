import { ActivityQuota } from 'src/global';
import { Argument, ArgumentType, Command, CommandType, MessageEmbed } from 'gcommands';
import { Colors, durationMilliseconds, ErrorEmbed, GetGuildData, PrettyMilliseconds, SaveGuildData } from './../../util';
import * as Sentry from '@sentry/node';
import SuccessEmbed from '../../util/SuccessEmbed';
import { GuildMember, GuildMemberRoleManager } from 'discord.js';
import { oneLine } from 'common-tags';

// todo: implement timed_actions and add support for it (auto-un-LOA someone when it expires)
// todo: for loas, the bot will see what roles have the quota, and what roles the user has, and ping the roles hte user has (that have a quota) so their bosses are notified
// todo: Change LOA role to /loa @user to give them the role and have it auto-unrole when LOA is over
new Command({
    name: 'quota',
    description: 'Modify the activity quota for the department.',
    type: [ CommandType.SLASH ],
    dmPermission: false,
    arguments: [
        new Argument({
            name: 'set',
            description: 'Set the quota for a unit.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'unit',
                    description: 'The unit responsible for meeting the quota',
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'time',
                    description: 'The time each log has to be. (e.g. 1h, 30m, 1h30m, etc.)',
                    type: ArgumentType.STRING,
                    required: true
                }),
                new Argument({
                    name: 'count',
                    description: 'The amount of logs that have to be submitted per cycle.',
                    type: ArgumentType.INTEGER,
                    required: true
                }),
                new Argument({
                    name: 'priority',
                    description: 'If a user has two roles, the unit with the highest priority will be used for the quota. Default "0"',
                    type: ArgumentType.INTEGER,
                    maxValue: 500
                }),
            ]
        }),
        new Argument({
            name: 'exempt',
            description: 'Exempt a unit from the quota.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'unit',
                    description: 'The unit responsible for meeting the quota',
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'status',
                    description: 'The status of their exemption (enabled/disabled).',
                    type: ArgumentType.STRING,
                    choices: [
                        { name: 'Exempt', value: 'exempt' },
                        { name: 'Not Exempt', value: 'not_exempt' }
                    ],
                    required: true
                }),
            ]
        }),
        new Argument({
            name: 'view',
            description: 'View the quota for a unit.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'unit',
                    description: 'The unit to view quota requirements for.',
                    type: ArgumentType.ROLE,
                    required: true
                }),
            ]
        }),
        new Argument({
            name: 'clear',
            description: 'Clear the quota for a unit.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'unit',
                    description: 'The unit to clear the quota for.',
                    type: ArgumentType.ROLE,
                    required: true
                }),
            ]
        }),
        new Argument({
            name: 'list',
            description: 'Show all roles with a quota',
            type: ArgumentType.SUB_COMMAND
        })
    ],
    async run(context) {
        try {
            const subCommand = context.arguments.getSubcommand();
            await context.deferReply({ ephemeral: true });
            const GuildData = await GetGuildData(context.client, context.guild!.id);
            if (!GuildData.config.activityLogs.enabled) return context.editReply('Activity quotas are disabled.');
            const activity = GuildData.config.activityLogs;
            const embed = new MessageEmbed()
                .setTitle('Activity Logs')
                .setColor(Colors.getColor('mayLOG'));
            const reply = (message: string, isError: boolean = false) => context.editReply({ embeds: [ (isError ? ErrorEmbed : SuccessEmbed)(message) ] });
            const isAdmin = (context.member! as GuildMember).permissions.has('ADMINISTRATOR');
            const isCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.departmentCommandRoles);
            if (!isAdmin && !isCommand) return context.editReply('You must be a command member to use this command.');

            if (subCommand === 'set') {
                const unit = context.arguments.getRole('unit')!;
                const time = context.arguments.getString('time')!;
                const count = context.arguments.getInteger('count')!;
                const priority = context.arguments.getInteger('priority') || 0;
                const msTime = durationMilliseconds(time);
                const index = activity.quota.findIndex(quota => quota.role === unit.id);

                if (msTime === false) return context.editReply('The `time` you provided is invalid.');
                if (index !== -1) activity.quota.splice(index, 1);

                const data: ActivityQuota = {
                    role: unit.id,
                    count: count,
                    priority: priority,
                    time: msTime,
                    isExempt: false
                }

                activity.quota.push(data);
                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                    reply(`Successfully edited quota for <@&${unit.id}>`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                });
            } else if (subCommand === 'enable') {
                const status = context.arguments.getString('status')!;
                const statusBoolean = status === 'enabled';
                activity.enabled = statusBoolean;

                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                    reply(`Successfully **${status}** activity quotas.`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                })
            } else if (subCommand === 'exempt') {
                const unit = context.arguments.getRole('unit')!;
                const status = context.arguments.getString('status')! === 'exempt';
                let isSuccess = false;

                activity.quota.forEach(quota => {
                    if (quota.role === unit.id) {
                        isSuccess = true;
                        quota.isExempt = status;
                    }
                });

                if (isSuccess) {
                    let message: string;
                    if (status) {
                        message = `Successfully **exempted** <@&${unit.id}> from the activity quota.`;
                    } else message = `Successfully **removed** the activity quota exemption for <@&${unit.id}>.`;

                    SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                        reply(message);
                    }).catch(error => {
                        Sentry.captureException(error);
                        reply('An error occurred while trying to save guild data.', true);
                    });
                } else {
                    reply('Failed to exempt unit. The unit may not exist.', true);
                }
            } else if (subCommand === 'skip') {
                const status = context.arguments.getBoolean('status')!;
                activity.cycle.isSkipped = status;
                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                   reply(`Successfully **${status ? 'skipped' : 'unskipped'}** the current activity log cycle.`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                });
            } else if (subCommand === 'view') {
                const unit = context.arguments.getRole('unit')!;
                const quota = activity.quota.find(quota => quota.role === unit.id);
                if (!quota) return reply('I could not find any quota set for the unit.', true);
                embed
                    .setDescription(`Quota information for ${unit}.`)
                    .addFields([
                        { name: 'Exempt', value: `\`${quota.isExempt}\``, inline: true },
                        { name: 'Priority', value: String(quota.priority), inline: true },
                        { name: 'Count', value: String(quota.count), inline: true },
                        { name: 'Log Duration', value: PrettyMilliseconds(quota.time, { verbose: true }), inline: true }
                    ]);
                context.editReply({ embeds: [ embed ] });
            } else if (subCommand === 'clear') {
                const unit = context.arguments.getRole('unit')!;
                const index = activity.quota.findIndex(quota => quota.role === unit.id);
                if (index === -1) return reply('I couldn\'t find that unit.', true);
                activity.quota.splice(index, 1);
                SaveGuildData(context.client, context.guild!.id, GuildData).then(() => {
                    reply(`Successfully **cleared** the quota for ${unit}.`);
                }).catch(error => {
                    Sentry.captureException(error);
                    reply('An error occurred while trying to save guild data.', true);
                });
            } else if (subCommand === 'list') {
                let description = ``;
                const sortedRoles = activity.quota.sort((a, b) => b.priority - a.priority);
                sortedRoles.forEach(quota => {
                    description += `${quota.isExempt ? '[EX]' : '[NX]'} <@&${quota.role}> (${quota.priority}) - \`${quota.count}x${PrettyMilliseconds(quota.time).replace(' ', '')}\`\n`;
                });

                embed
                    .setDescription('The following roles have a quota attached to them.')
                    .addFields({ name: '[EXEMPT?]Role (Priority) - LogRequirements', value: description});
                context.editReply({ embeds: [ embed ] });
            }
        } catch (error) {
            Sentry.captureException(error);
            return context.safeReply({ ephemeral: true, content: 'An error occurred. '});
        }
    },
});