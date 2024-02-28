import { Database } from 'src/global';
import { Argument, ArgumentType, Command, CommandType, MessageEmbed } from 'gcommands';
import { Colors, GetGuildData, GetRoVerLink, PrettyMilliseconds } from '../../util';
import { GuildMember, GuildMemberRoleManager } from 'discord.js';
import * as Sentry from '@sentry/node';


// todo: add a dept-command check?
// todo: add a config command to automatically run the /check command

//! todo: Before release, ensure that all activity log features are protected behind config.activityLogs.enabled!!!

// todo: Add an option to get the LAST WEEKS patrol logs as well. It will display last weeks logs in the same embed as the current
// otherwise, it uses the default one

new Command({
    name: 'check',
    description: 'Check activity logs for a unit.',
    type: [ CommandType.SLASH ],
    dmPermission: false,
    arguments: [
        new Argument({
            name: 'non_ephemeral',
            description: 'Show the embed to others?',
            type: ArgumentType.BOOLEAN,
            required: true
        }),
        new Argument({
            name: 'unit',
            description: 'The unit to check log for.',
            type: ArgumentType.ROLE,
            required: true
        }),
        new Argument({
            name: 'previous_cycle',
            description: 'Retrieve the logs for the previous cycle?',
            type: ArgumentType.BOOLEAN
        })
    ],
    async run(context) {
        try {
            const db = context.client.getDatabase<Database>();
            const activityManager = db.activityManager;
            const non_ephemeral = context.arguments.getBoolean('non_ephemeral')!;
            const unit = context.arguments.getRole('unit')!;
            const previous_cycle = context.arguments.getBoolean('previous_cycle')!;
            await context.deferReply({ ephemeral: non_ephemeral });
            const GuildData = await GetGuildData(context.client, context.guild!.id);
            const member = context.member! as GuildMember;
            const isAdmin = member.permissions.has('ADMINISTRATOR');
            const isCommand = (context.member?.roles as GuildMemberRoleManager).cache.hasAny(...GuildData.config.commandRoles);
            if (!isAdmin && !isCommand) return context.editReply('You must be a command member to use this command.');
            if (!GuildData.config.activityLogs.enabled) return context.editReply('Activity quotas are disabled.');
            const activity = GuildData.config.activityLogs;
            const cycleDuration = activity.cycle.duration;
            const cycleEndMs = previous_cycle ? activity.cycle.cycleEndMs - cycleDuration : activity.cycle.cycleEndMs;
            const cycleId = previous_cycle ? `${cycleDuration}-${cycleEndMs - cycleDuration}` : `${cycleDuration}-${cycleEndMs}`;
            const embed = new MessageEmbed()
                .setColor(Colors.getColor('mayLOG'))
                .setTitle(`Log Statistics for ${unit.name}`);
            const cycle = await activityManager.createCycle(GuildData, false, cycleId);
            const users = cycle.users.filter(u => u.roleProcessed === unit.id);
            if (users.length === 0) {
                embed.setDescription('Nobody in that unit has been processed. The unit either has no quota or nobody is in it.');
                context.editReply({ embeds: [ embed ] });
                return;
            }
            const promises = users.map(user => GetRoVerLink(context.guild!.id, user.discordId, db.redis).catch(() => {}));
            const userInfo = await Promise.all(promises);
            const getUsername = (discordId: string) => {
                const result = userInfo.filter(u => !!u!).filter(u => u!.discordId === discordId)[0]!;
                return result ? result.cachedUsername || 'Username error' : `Retrieval error; DiscordId ${discordId}`;
                // return exactResult || 'Error retrieving username;'.cachedUsername || 'Error retrieving username';
            }
            const notMet = users.filter(u => !u.isMet).length;
            const replacement = notMet === 1 ? [ 'is', '', 'es' ] : [ 'are', 's', '' ];
            const notMetMsg = notMet > 0 ? `There ${replacement[0]} ${notMet} individual${replacement[1]} that do${replacement[2]} not meet the activity quota.` : '';
            embed.setDescription(`${notMetMsg}\nCycle of <t:${(Math.floor((cycleEndMs - cycleDuration) / 1000))}:F> to <t:${Math.floor(cycleEndMs / 1000)}:F>`);

            const limitPerPage = 25;
            const iterations = Math.ceil(users.length / limitPerPage);
            let page = 1;
            let isReplySent = false;
            for (let i = 0; i < iterations; i++) {
                const batch = users.slice((i * limitPerPage), (i * limitPerPage) + limitPerPage);
                for (const user of batch) {
                    const emoji = (user.isMet || user.isExcused || user.isExempt || cycle.isSkipped) ? '✅' : '❌';
                    let msg = '';
                    if (user.isExcused || cycle.isSkipped) {
                        msg = '`Excused` ';
                    } else if (user.isExempt) {
                        msg = '`Exempt` ';
                    }
                    embed.addFields({
                        name: `${emoji} ${getUsername(user.discordId)}`,
                        value: `${msg} Submitted ${user.logsSubmitted.length} logs ${user.loggedMs ? `(${PrettyMilliseconds(user.loggedMs, { verbose: true })})` : ''}`,
                        inline: false
                    })
                }
                embed.setFooter({ text: `Page ${page} of ${iterations}`});
                if (isReplySent) {
                    isReplySent = true;
                    await context.editReply({ embeds: [ embed ] });
                } else {
                    await context.followUp({ ephemeral: non_ephemeral, embeds: [ embed ] });
                }
                embed.fields = [];
                page++;

            }
        } catch (error) {
            Sentry.captureException(error);
            context.safeReply({ ephemeral: true, content: 'An error occurred.' });
        }

        // code
        return;
    }
});