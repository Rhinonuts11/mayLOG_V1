import { Argument, ArgumentType, Command, CommandType, MessageEmbed } from 'gcommands';
import { Colors, GetGuildData, SaveGuildData } from '../../util';
import { Database, GuildData } from '../../global';
import { DateTime } from 'luxon';
import { GetRoVerLink }  from '../../util';
import * as Sentry from '@sentry/node';
import Constants from '../../Constants';
import DeveloperInhibitor from '../../inhibitors/DeveloperInhibitor';

function createDetailedTimestamp(seconds: number, includeR: boolean = true): string {
    return `<t:${seconds}:F>${includeR ? ` (<t:${seconds}:R>)` : ''}`;
}

function GetRecentCommands(dates: Date[]): string[] {
    return dates
        .sort((a: any, b: any) => b - a)
        .slice(0, 15)
        .map(d => d.toISOString())
        .map(iso => Math.floor(DateTime.fromISO(iso).toUTC().toSeconds()))
        .map(ts => createDetailedTimestamp(ts));
}

new Command({
    name: 'dev',
    description: 'Run developer commands.',
    type: [ CommandType.SLASH ],
    inhibitors: [ new DeveloperInhibitor() ],
    dmPermission: false,
    guildId: Constants.developerGuildId,
    arguments: [
        new Argument({
            name: 'list_guilds',
            description: 'List all guilds this mayLOG instance is in.',
            type: ArgumentType.SUB_COMMAND,
        }),
        new Argument({
            name: 'leave_guild',
            description: 'Force mayLOG to leave a guild.',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'guild_id',
                    description: 'The Guild ID to leave.',
                    type: ArgumentType.STRING,
                    required: true
                })
            ]
        }),
        new Argument({
            name: 'guild_blacklist',
            description: 'Modify guild blacklists',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'status',
                    description: 'Modify blacklist status',
                    type: ArgumentType.STRING,
                    required: true,
                    choices: [ { name: 'index', value: 'index' }, { name: 'disable', value: 'disable' }, { name: 'enable', value: 'enable' } ]
                }),
                new Argument({
                    name: 'guild_id',
                    description: 'Guild ID. Leave blank to return a full list.',
                    type: ArgumentType.STRING,
                }),
                new Argument({
                    name: 'reason',
                    description: 'The reason for the blacklist. Only used if `status` is `enable`',
                    type: ArgumentType.STRING
                })
            ]
        }),
        new Argument({
            name: 'guild_info',
            description: 'Retrieve guild info',
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'guild_id',
                    description: 'Guild ID',
                    required: true,
                    type: ArgumentType.STRING
                })
            ]
        })
    ],
    async run(context) {
        try {
            await context.deferReply({ ephemeral: true });
            const mongo = context.client.getDatabase<Database>().mongo;
            const subCommand = context.arguments.getSubcommand();
            const embed = new MessageEmbed()
                .setColor(Colors.getColor('mayLOG'))
                .setTitle('Guilds');

            if (subCommand === 'list_guilds') {
                const guilds = context.client.guilds.cache;
                embed.setDescription(`mayLOG is in \`${guilds.size}\` guilds and has \`${context.client.users.cache.size}\` users.`);
                // Discord allows a lot of fields, so pagination isn't needed.
                guilds.forEach(guild => {
                    embed.addFields({ name: `${guild.name} - \`${guild.id}\``, value: `**Members**: \`${guild.memberCount}\`` });
                });
                context.editReply({ embeds: [ embed ] });
            } else if (subCommand === 'leave_guild') {
                const guild_id = context.arguments.getString('guild_id')!;
                const guild = context.client.guilds.cache.get(guild_id);
                if (!guild) return context.editReply('The guild provided was not found.');

                guild.leave().then(() => {
                    context.editReply('mayLOG has successfully left the guild.');
                }).catch(error => {
                    context.editReply('An error occurred while attempting to leave the guild.');
                    console.error(error);
                })
            } else if (subCommand === 'guild_blacklist') {
                const guildStatus = context.arguments.getString('status')! as 'index' | 'disable' | 'enable';
                const guild_id = context.arguments.getString('guild_id');
                const reason = context.arguments.getString('reason');

                if (guildStatus === 'index') {
                    mongo.db('maylog').collection('guilds').find<GuildData>({}).toArray().then(guilds => {
                        const blacklists: GuildData[] = [];
                        guilds.forEach(g => {
                            if (g.blacklist && g.blacklist.status) blacklists.push(g);
                        });

                        const embed = new MessageEmbed()
                            .setTitle('Guild Blacklists')
                            .setColor(Colors.getColor('mayLOG'));

                        if (blacklists.length === 0) {
                            embed.setDescription('There are no active blacklists.');// : blacklists.map(b => `${b._id} - \`${b.blacklist.reason}\``).join('\n'));
                        } else {
                            embed.addFields(blacklists.map(b => {
                                return { name: `\`${b._id}\``, value: b.blacklist.reason! }
                            }));
                        }

                        context.editReply({ embeds: [ embed ] });
                    }).catch(() => context.editReply('An error occurred while fetching blacklists from the database.'));
                } else if (guildStatus === 'enable') {
                    GetGuildData(context.client, guild_id!).then(guild => {
                        if (guild.blacklist.status) return context.editReply(`This guild has an active blacklist for: \`${guild.blacklist.reason}\``);
                        guild.blacklist.status = true;
                        guild.blacklist.reason = reason || 'No reason specified.';

                        SaveGuildData(context.client, guild_id!, guild).then(() => {
                            context.editReply(`Guild successfully blacklisted for \`${guild.blacklist.reason}\`.`)
                        }).catch(() => context.editReply('An error occurred while attempting to save the blacklist.'));
                        return;
                    }).catch(() => context.editReply('An error occurred while fetching data for the guild.'));
                } else if (guildStatus === 'disable') {
                    GetGuildData(context.client, guild_id!).then(guild => {
                        if (!guild.blacklist.status) return context.editReply('This guild has no active blacklist.');
                        guild.blacklist = { status: false, reason: undefined };

                        SaveGuildData(context.client, guild_id!, guild).then(() => {
                            context.editReply('Guild successfully unblacklisted.');
                        }).catch(() => context.editReply('An error occurred while attempting to save the reversed blacklist.'));
                        return;
                    }).catch(() => context.editReply('An error occurred while fetching data for the guild.'));
                }
            } else if (subCommand === 'guild_info') {
                const guild_id = context.arguments.getString('guild_id')!;
                GetGuildData(context.client, guild_id).then(async guild => {
                    const createEmbed = (title: string) => {
                        const embed = new MessageEmbed()
                            .setColor(Colors.getColor('mayLOG'))
                            .setTitle(title);
                        return embed;
                    }
  
                    const statisticsEmbed = createEmbed('Guild Statistics');
                    statisticsEmbed
                        .addFields([
                            { name: 'Activity log status', value: `\`${String(guild.config.activityLogs.accessEnabled)}\``, inline: true },
                            { name: 'Blacklist status', value: `\`${String(guild.blacklist.status)}\``, inline: true }
                        ])
                    
                    const discordGuild = context.client.guilds.cache.get(guild_id);
                    if (discordGuild) {
                        statisticsEmbed.setDescription(`
                            Guild Creation: ${createDetailedTimestamp(Math.floor(discordGuild.createdTimestamp / 1000))}
                            Joined: ${createDetailedTimestamp(Math.floor(discordGuild.members.me!.joinedTimestamp! / 1000))}
                            Members: \`${discordGuild.members.cache.size}\``)
                        statisticsEmbed.addFields({ name: 'Has RoVer', value: discordGuild.members.cache.has(Constants.RoVer_Bot_ID) ? '`true`' : '`false`', inline: true });

                        await context.client.users.fetch(discordGuild.ownerId).then(user => {
                            statisticsEmbed.addFields({ name: 'Discord Account', value: `${user.username}${user.discriminator === '0' ? '' : `#${user.discriminator}`} / \`${user.id}\``, inline: true }); 
                        }).catch(() => {
                            statisticsEmbed.addFields({ name: 'Discord Account', value: 'Unavailable.', inline: true });
                        });

                        await GetRoVerLink(discordGuild.id, discordGuild.ownerId).then(robloxData => {
                            statisticsEmbed.addFields({ name: 'Roblox Account', value: `${robloxData.cachedUsername} / \`${robloxData.robloxId}\``, inline: true });
                        }).catch(() => {
                            statisticsEmbed.addFields({ name: 'Roblox Account',  value: 'Unavailable.', inline: true })
                        });

                        // Get the recent 15 commands in the server
                        await mongo.db('maylog').collection('guild-activity').findOne({ _id: discordGuild.id }).then(activityData => {
                            statisticsEmbed.setDescription(statisticsEmbed.description! + `\nCommands run: \`${activityData ? activityData.recentCommands.length : 0}\``)
                            if (!activityData) return statisticsEmbed.addFields({ name: 'Recent Commands', value: 'None.' });
                            statisticsEmbed.addFields({ name: 'Recent Commands', value: GetRecentCommands(activityData.recentCommands as Date[]).join('\n')});
                            return;
                        }).catch(error => {
                            Sentry.captureException(error);
                            statisticsEmbed.addFields({ name: 'Recent Commands', value: 'Error retrieving.' })
                        });
                    } else {
                        statisticsEmbed.setDescription('No guild data could be found.');
                    }

                    await context.editReply({ embeds: [ statisticsEmbed ] });
                }).catch(error => context.editReply(`An error occurred while retrieving guild data from the database. ${error}`));
            }
        } catch (error) {
            context.editReply('I experienced an error while running that command');
            context.followUp(`\`${String(error)}\``);
        }
        return;
    }
});