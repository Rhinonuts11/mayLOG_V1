import { Colors, GetGuildData, GetRoVerLink, PrettyMilliseconds, SaveGuildData } from './util';
import { Database, GuildData, ActivityQuota, IMActivityCycle, IActivityCycleSkippedUser } from './global';
import luxon from 'luxon';
const { DateTime } = luxon;
import { GClient } from 'gcommands';
import { GuildMember, MessageEmbed, TextChannel } from 'discord.js';
import { MongoClient, ObjectId, UpdateResult } from 'mongodb';
import { Redis } from 'ioredis';
import * as Sentry from '@sentry/node';
import ActivityAPI from './ActivityAPI';
import Constants from './Constants';

interface IResult {
    robloxId: number;
    cachedUsername: string;
    discordId: string;
    guildId: string;
}
interface IActivityLog {
    robloxId: number;
    discordId: string;
    guild: string;
    /** ${activity.cycle.duration}-${activity.cycle.cycleEndMs} */
    cycle: string;
    ts: Date;
    submission: {
        startImage: string;
        endImage: string;
        date: Date;
        startMs: number;
        endMs: number;
    }
}

interface IActivityCycleUser {
    // robloxId: string;
    discordId: string;
    /** Whether the role was processed (otherwise user was/ user cmd-skip) */
    roleProcessed: string;
    isMet: boolean;
    isExempt: boolean;
    loggedMs: number;
    isExcused: boolean;
    logsSubmitted: ObjectId[];
    attributes?: any;
}

export class ActivityCycle {
    users = new Set<IActivityCycleUser>();
    guildId: string;
    /** cycleDuration-cycleEndMs */
    cycleId: string;
    isSkipped: boolean;
    constructor(guildId: string, cycleId: string, isSkipped: boolean) {
        this.guildId = guildId;
        this.cycleId = cycleId;
        this.isSkipped = isSkipped;
    }
    addUser(user: IActivityCycleUser) {
        this.users.add(user);
    }
    addUsers(users: IActivityCycleUser[]) {
        users.forEach(u => this.users.add(u));
    }
}

export class ActiveActivityLog {
    serverId: string;
    /** Milliseconds indicating when the log was started. */
    startedAtMs: number;
    robloxId: number;
    guildId: string;
    discordId: string;
    lastKeepAlive: number;
    constructor(serverId: string, startedAt: number, robloxId: number, discordId: string, lastKeepAlive: number, guildId: string) {
        this.serverId = serverId;
        this.startedAtMs = startedAt;
        this.robloxId = robloxId;
        this.discordId = discordId;
        this.lastKeepAlive = lastKeepAlive;
        this.guildId = guildId;
    }
    get duration() {
        return Math.floor(DateTime.now().toMillis() - this.startedAtMs);
    }
}

export class ActivityLog {
    public startImage: string = '';
    public endImage: string = '';
    public startMs: number = 0;
    public endMs: number = 0;
    public date: DateTime | undefined;
    public guildId?: string;
    public id?: ObjectId;
    /**
     * The Roblox UserId of the individual responsible for the log.
     */
    public robloxId: number;
    /**
     * The Discord UserId of the individual responsible for the log.
     */
    public discordId: string;
    private redis: Redis;
    private mongo: MongoClient;
    /**
     * Create a new activity log.
     * @param userId The Roblox UserId of the individual responsible for this log.
     */
    constructor(client: GClient, robloxId: number, discordId: string) {
        const db = client.getDatabase<Database>();
        this.robloxId = robloxId;
        this.discordId = discordId;
        this.redis = db.redis;
        this.mongo = db.mongo;
    }
    setStartImage(image: string) {
        this.startImage = image;
        return this;
    }
    setEndImage(image: string) {
        this.endImage = image;
        return this;
    }
    setStartMs(ms: number) {
        this.startMs = ms;
        return this;
    }
    setEndMs(ms: number) {
        this.endMs = ms;
        return this;
    }
    setDate(date: DateTime) {
        this.date = date;
        return this;
    }
    setLogId(id: ObjectId) {
        this.id = id;
        return this;
    }
    setGuildId(id: string) {
        this.guildId = id;
        return this;
    }
    /**
     * Returns an embed
     * @warning Yields - fetches Roblox username from UserId
     * @returns An embed
     */
    async toEmbed(robloxUsername?: string): Promise<MessageEmbed> {
        return new Promise(async (resolve, reject) => {
            try {
                let username;
                if (!robloxUsername) {
                    const data = await GetRoVerLink(this.guildId!, this.discordId, this.redis);
                    username = data.cachedUsername;
                } else username = robloxUsername;

                const startTime = DateTime.fromMillis(this.startMs).toUTC().toFormat('h:mm a ZZZZ');
                const endTime = DateTime.fromMillis(this.endMs).toUTC().toFormat('h:mm a ZZZZ');
                const embed = new MessageEmbed()
                    .setTitle('Activity Log Submission')
                    .setColor(Colors.getColor('mayLOG'))
                    .addFields([
                        { name: 'Username', value: username },
                        { name: 'Date', value: this.date!.toISODate()! },
                        { name: 'Start Time', value: `<t:${Math.floor(this.startMs / 1000)}:t> (\`${startTime}\`)` },
                        { name: 'End Time', value: `<t:${Math.floor(this.endMs / 1000)}:t> (\`${endTime}\`)` },
                        { name: 'Start Image', value: this.startImage },
                        { name: 'End Image', value: this.endImage },
                        { name: 'Duration', value: PrettyMilliseconds(Math.abs(this.endMs - this.startMs), { verbose: true }) },
                    ]);
                if (this.id) {
                    embed.setFooter({ text: `Log ID: ${this.id.toString()} `});
                }
                resolve(embed);
            } catch (error) {
                Sentry.captureException(error);
                reject()
            }
        });
    }
}

export class ActivityManager {
    /** MongoDB Client */
    private mongo: MongoClient;
    /** Redis Client */
    private redis: Redis;
    /** GClient */
    private client!: GClient;
    constructor(mongo: MongoClient, redis: Redis) {
        this.mongo = mongo;
        this.redis = redis;
    }
    setClient(client: GClient) {
        this.client = client;
    }
    async processIngameLogs() {

    }
    getQuotaForMember(guild: GuildData, member: GuildMember): ActivityQuota | undefined {
        // If the user has multiple priority 0 roles, the first quota is selected.
        const quota = guild.config.activityLogs.quota;
        const sharedRoles: ActivityQuota[] = [];
        quota.forEach(quota => {
            if (member.roles.cache.has(quota.role)) sharedRoles.push(quota);
        });
        sharedRoles.sort((a, b) => {
            return b.priority - a.priority;
        });
        return sharedRoles[0];
    }
    startIngameLog(guildId: string, robloxId: number, discordId: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const status = await this.getIngameLogStatus(robloxId);
                if (status) return reject('ONGOING_LOG');
            } catch {
                return reject('Failed to get log status');    
            }
            this.redis.setex(`${Constants.redisKeys.logs}/${robloxId}`, 3600 * 6, JSON.stringify({
                robloxId: robloxId,
                discordId: discordId,
                guildId: guildId,
                startedAt: Math.floor(Date.now()),
                lastKeepAlivePing: Math.floor(Date.now())
            })).then(() => resolve()).catch(reject)
        });
    }
    getIngameLogStatus(robloxId: number): Promise<ActiveActivityLog | void> {
        return new Promise(async (resolve, reject) => {
            this.redis.get(`${Constants.redisKeys.logs}/${robloxId}`).then(async log => {
                if (!log) return resolve();
                const jlog = JSON.parse(log) as any;
                try {
                    const result = await ActivityAPI.GetPlayerServer(robloxId);
                    if (result) {
                        return resolve(new ActiveActivityLog(result.server.serverId, jlog.startedAt, robloxId, jlog.discordId, jlog.lastKeepAlivePing, jlog.guildId));
                    } else {
                        return resolve(new ActiveActivityLog('', jlog.startedAt, robloxId, jlog.discordId, jlog.lastKeepAlivePing, jlog.guildId));
                    }
                } catch {
                    reject();
                }
            })
        });
    }
    endIngameLog(robloxId: number, status?: void | ActiveActivityLog, noSubmit?: boolean): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!status) status = await this.getIngameLogStatus(robloxId);
                if (!status) return resolve(false);
                try {
                    await this.redis.del(`${Constants.redisKeys.logs}/${robloxId}`);
                } catch (error) {
                    console.log(`Deleting cached log ${Constants.redisKeys.logs}/${robloxId}`);
                    Sentry.captureException(error);
                }
                if (noSubmit) return resolve(true);
                const log = new ActivityLog(this.client, status.robloxId, status.discordId)
                    .setDate(DateTime.fromMillis(status.startedAtMs))
                    .setStartMs(status.startedAtMs)
                    .setEndMs(Math.floor(Date.now()))
                    .setStartImage('IN-GAME LOG')
                    .setEndImage('IN-GAME LOG')
                    .setGuildId(status.guildId);
            const guildData = await GetGuildData(this.client, status.guildId);
            const RoVerData = await GetRoVerLink(status.guildId, status.discordId, this.redis);
            this.submitLog(guildData, log, RoVerData).then(([isSuccess, id]) => {
                resolve(true);
            }).catch(() => {
                resolve(false);
            });
            } catch (error) {
                reject(error);
            }
        });
    }
    async fetchLog(logId: ObjectId, guild?: string): Promise<ActivityLog | void> {
        return new Promise(async (resolve, reject) => {
            try {
                const query: { _id: ObjectId, isDeleted: boolean, guild?: string } = { _id: logId, isDeleted: false };
                if (guild) query.guild = guild;

                this.mongo.db('maylog').collection('activity-logs').findOne(query).then(log => {
                    if (!log) return resolve();
                    const activityLog = new ActivityLog(this.client, log.robloxId, log.discordId)
                        .setDate(DateTime.fromJSDate(log.submission.date))
                        .setStartMs(log.submission.startMs)
                        .setEndMs(log.submission.endMs)
                        .setStartImage(log.submission.startImage)
                        .setEndImage(log.submission.endImage)
                        .setLogId(log._id)
                        .setGuildId(log.guild);
                    resolve(activityLog);
                }).catch(error => {
                    Sentry.captureException(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    async deleteLog(logId: ObjectId, reason: string | null): Promise<UpdateResult> {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(await this.mongo.db('maylog').collection('activity-logs').updateOne({ _id: logId}, {
                    $set: { isDeleted: true, deleteReason: reason || 'No reason provided.' }
                }));
            } catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Submit an activity log. Returns an ObjectId of the submitted log.
     * @param db The database object (found in GClient.getDatabase())
     * @param guild The GuildData object for the guild.
     * @param log The activity log class.
     */
    async submitLog(guild: GuildData, log: ActivityLog, roverData: IResult): Promise<[boolean, ObjectId]> {
        return new Promise(async (resolve, reject) => {
            const activity = guild.config.activityLogs;

            this.mongo.db('maylog').collection('activity-logs').insertOne({
                robloxId: log.robloxId,
                discordId: log.discordId,
                guild: guild._id,
                cycle: `${activity.cycle.duration}-${activity.cycle.cycleEndMs}`,
                ts: new Date(),
                submission: {
                    startImage: log.startImage,
                    endImage: log.endImage,
                    date: log.date,
                    startMs: log.startMs,
                    endMs: log.endMs
                },
                isDeleted: false
            }).then(async document => {
                log.setLogId(document.insertedId);
                const logEmbed = await log.toEmbed(roverData.cachedUsername);
                this.client.users.fetch(log.discordId).then(async user => {
                    let isSuccess = false;
                    try {
                        await user.send({ embeds: [ logEmbed ] }).then(() => {
                            isSuccess = true;
                        });
                    } catch {}
                    this.client.guilds.fetch(guild._id).then(guildClass => {
                        const channelId = guild.config.activityLogChannel;
                        if (!guildClass) return reject('Guild not found');
                        if (channelId === false) return resolve([ isSuccess, document.insertedId ]);

                        guildClass.channels.fetch(channelId as string).then(channel => {
                            if (!channel) return resolve([ isSuccess, document.insertedId ]);
                            (channel as TextChannel).send({ embeds: [ logEmbed ] }).then(() => {
                                resolve([ isSuccess, document.insertedId ]);
                            }).catch(() => {}).finally(() => {
                                resolve([ isSuccess, document.insertedId ]);
                            });
                        }).catch(() => {
                            resolve([ isSuccess, document.insertedId ]);
                        });
                    }).catch(error => {
                        reject(error)
                    });
                }).catch(() => {
                    resolve([ false, document.insertedId ]);
                });
            }).catch(error => {
                Sentry.captureException(error);
                reject(error);
            });
        });
    }
    async submitCycle(cycle: IMActivityCycle): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (cycle.cycleId === '0-0') reject('INVALID_CYCLE');
            const guild = await GetGuildData(this.client, cycle.guildId);
            const skippedUsers = cycle.users.filter(u => u.isExcused).map(u => u.discordId);
            const activity = guild.config.activityLogs;
            if (cycle.isSkipped) activity.cycle.isSkipped = false;
            activity.cycle.cycleEndMs += activity.cycle.duration;
            const eReject = (error: any) => {
                Sentry.captureException(error);
                console.log(`Failed to process ${guild._id} cycle (${cycle.cycleId}: ${error})`);
                reject(error);
            }
            this.mongo.db('maylog').collection('cycles').insertOne(cycle)
                .then(() => {
                    SaveGuildData(this.client, guild._id, guild).then(() => {
                        this.mongo.db('maylog').collection('skipped_users').deleteMany({ userId: { $in: skippedUsers } }).then(doc => {
                            resolve();
                        }).catch(eReject);
                    }).catch(eReject);
                }).catch(eReject);
            // this.mongo.db('maylog').collection('cycles').insertOne({
            //     cycleId: cycleId,
            //     guildId: guild._id,
            //     isSkipped: cycle.isSkipped,
            //     users: [ ...quotas.met, ...quotas.not_met ]
            // }).then(() => {
            //     if (cycle.isSkipped) activity.cycle.isSkipped = false;
            //     console.log(`Cycle for ${guild._id} saved; id ${cycleId}. Attempting to save guild data.`)
            //     SaveGuildData(this.client, guild._id, guild).then(() => {
            //         console.log(`Activity cycle (${cycleId}) expired (${guild._id}); data saved. Next cycle ends in ${PrettyMilliseconds(Math.floor(Date.now()) - activity.cycle.cycleEndMs)}`);
            //         this.mongo.db('maylog').collection('skipped_users').deleteMany({ _id: { $in: removeSkippedUsers } }).then(doc => {
            //             console.log(`${doc.acknowledged}: Deleted ${guild._id} skipped users: ${doc.deletedCount}`);
            //         }).catch(error => Sentry.captureException(error))
            //     }).catch(error => {
            //         Sentry.captureException(error);
            //         console.log(`Failed to save guild cycle data for ${guild._id}: ${error}`);
            //     })
            // }).catch(error => {
            //     console.log(`Failed to process ${guild._id} cycle: ${error}`);
            //     Sentry.captureException(error);
            // });
        });
    }
    async createCycle(guild: GuildData, doDateCheck: boolean = false, cycleId?: string): Promise<IMActivityCycle> {
        return new Promise(async (resolve, reject) => {
            const discordGuild = this.client.guilds.cache.get(guild._id);
            if (!discordGuild) return reject('GUILD_NOT_FOUND');

            const activity = guild.config.activityLogs;
            const cycle = activity.cycle;
            if (!cycleId) cycleId = `${activity.cycle.duration}-${activity.cycle.cycleEndMs}`;
            if (!activity || !activity.enabled) return reject('ACTIVITY_NOT_ENABLED');
            if (doDateCheck && Date.now() < activity.cycle.cycleEndMs) return reject('DATE_ERROR');
            if (cycleId === '0-0') return reject('INVALID_CYCLE');

            /** Return a list of members who participated in the cycle */
            const getParticipatingMembers = () => {
                // We need to get all members with a role
                const members = new Map<string, ActivityQuota>();
                const memberIds: string[] = [];
                discordGuild.members.cache.forEach(member => {
                    const quota = this.getQuotaForMember(guild, member);
                    if (quota) {
                        members.set(member.id, quota);
                        memberIds.push(member.id);
                    }
                });
                return members;
            }
            const members = getParticipatingMembers();
            const memberIds = (() => {
                const ids = [];
                for (const memberId of members.keys()) {
                    ids.push(memberId);
                }
                return ids;
            })();
            const skippedUsers = await this.mongo.db('maylog').collection('skipped_users')
                .find<IActivityCycleSkippedUser>({ guildId: guild._id, cycle: cycleId }).toArray();
            const activityLogs = await this.mongo.db('maylog').collection('activity-logs')
                .find<IActivityLog & { _id: ObjectId }>({ cycle: cycleId, guild: guild._id, discordId: { $in: memberIds }, isDeleted: false }).toArray();

            const removeSkippedUsers: ObjectId[] = [];
            /** Return a dictionary with members who both met and failed to meet the quota */
            const getQuotaList = () => {
                const data: { met: IActivityCycleUser[], not_met: IActivityCycleUser[] } = { met: [], not_met: [] };
                members.forEach((quota, memberId) => {
                    let loggedActivityMs = 0;
                    const recordedLogs = activityLogs.filter(log => log.discordId === memberId);
                    const skippedUsersArray = skippedUsers.filter(user => user.userId === memberId);
                    recordedLogs.forEach(log => {
                        loggedActivityMs += Math.abs(Math.floor(log.submission.endMs - log.submission.startMs));
                    });
                    const isMet = loggedActivityMs >= quota.time && recordedLogs.length >= quota.count;
                    const isExcused = skippedUsersArray.length >= 1;
                    if (isExcused) removeSkippedUsers.push(skippedUsersArray[0]._id);
                    /**
                       In order to be exused, the user has to meet ANY of the following criteria:
                       (1) have their cycle SKIPPED with `cycle.isSkipped`
                       (2) have their `unit quota` be exempt
                       (3) be excused with `/cycle excuse`
                     */
                    /**
                        The user has to:
                        (1) meet the quota per log
                        (2) submit at least {COUNT} logs (which only submit if the quota is met)
                        - people can submit multiple logs per day
                    */
                    const userData: IActivityCycleUser = {
                        discordId: memberId,
                        isMet: isMet,
                        loggedMs: loggedActivityMs,
                        roleProcessed: quota.role,
                        isExempt: quota.isExempt,
                        isExcused: isExcused,
                        logsSubmitted: recordedLogs.map(log => log._id),
                    }
                    if (isMet || isExcused || quota.isExempt) {
                        data.met.push(userData);
                    } else data.not_met.push(userData);
                });
                return data;
            }

            const quotas = getQuotaList();
            const nextCycle = activity.cycle.cycleEndMs + activity.cycle.duration;
            activity.cycle.cycleEndMs = nextCycle;
            const cycleData: Omit<IMActivityCycle, '_id'> = {
                cycleId: cycleId,
                guildId: guild._id,
                isSkipped: cycle.isSkipped,
                users: [ ...quotas.met, ...quotas.not_met ]
            }
            resolve(cycleData as IMActivityCycle);
            // this.mongo.db('maylog').collection('cycles').insertOne({
            //     cycleId: cycleId,
            //     guildId: guild._id,
            //     isSkipped: cycle.isSkipped,
            //     users: [ ...quotas.met, ...quotas.not_met ]
            // }).then(() => {
            //     if (cycle.isSkipped) activity.cycle.isSkipped = false;
            //     console.log(`Cycle for ${guild._id} saved; id ${cycleId}. Attempting to save guild data.`)
            //     SaveGuildData(this.client, guild._id, guild).then(() => {
            //         console.log(`Activity cycle (${cycleId}) expired (${guild._id}); data saved. Next cycle ends in ${PrettyMilliseconds(Math.floor(Date.now()) - activity.cycle.cycleEndMs)}`);
            //         this.mongo.db('maylog').collection('skipped_users').deleteMany({ _id: { $in: removeSkippedUsers } }).then(doc => {
            //             console.log(`${doc.acknowledged}: Deleted ${guild._id} skipped users: ${doc.deletedCount}`);
            //         }).catch(error => Sentry.captureException(error))
            //     }).catch(error => {
            //         Sentry.captureException(error);
            //         console.log(`Failed to save guild cycle data for ${guild._id}: ${error}`);
            //     })
            // }).catch(error => {
            //     console.log(`Failed to process ${guild._id} cycle: ${error}`);
            //     Sentry.captureException(error);
            // });
        });
    }
}
