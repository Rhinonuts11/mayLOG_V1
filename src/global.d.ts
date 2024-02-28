import { ActivityManager } from './Activity';
import { MongoClient, ObjectId } from 'mongodb';
import { Redis } from 'ioredis';

// todo: rebrand a lot of these as I<Interface>

// todo: include ActivityLog (class) from maylog.activity-logs in this

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            /** MongoDB URI */
            MONGO_URI: string;
            /** Redis host (IP address) */
            REDIS_HOST: string;
            /** Redis password */
            REDIS_PASSWORD: string;
            /** API Token for Activity API access */
            ACTIVITY_TOKEN: string;
            /** Production Discord bot token */
            DISCORD_PRODUCTION_TOKEN: string;
            /** Development Discord bot token */
            DISCORD_DEVELOPMENT_TOKEN: string;
            /** Sentry DSN token */
            SENTRY_DSN: string;
            /** Rover API Key */
            ROVER_API_KEY: string;
        }
    }
}

export interface Database {
    mongo: MongoClient;
    redis: Redis;
    activityManager: ActivityManager;
}

export interface ICommandLog {
    action: string;
    subject?: { name: string; id: number };
    arguments: {
        name: string;
        type: string;
        value: string;
    }[],
    ts: Date;
}

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

interface IActivityCycleSkippedUser {
    _id: ObjectId;
    // robloxId: string;
    userId: string; //todo: change in next update (to match mongo)
    guildId: string;
    /** ${activity.cycle.duration}-${activity.cycle.cycleEndMs} */
    cycleId: string;
}

interface IActivityCycleUser {
    // robloxId: string;
    discordId: string;
    /** ROLE ID that was processed (otherwise user was/ user cmd-skip) */
    roleProcessed: string;
    isMet: boolean;
    isExempt: boolean;
    loggedMs: number;
    isExcused: boolean;
    logsSubmitted: ObjectId[];
    attributes?: any;
}

export interface ActivityQuota {
    /** Role ID */
    role: string;
    /** Log priority. */
    priority: number;
    /** The amount of logs per cycle required. */
    count: number;
    /** Millisecond-duration for how long a log must be. */
    time: number;
    /** A boolean indicating if the unit is exempt or not. */
    isExempt: boolean;
}

export interface ActivityCycle {
    /** The cycle id (duration-endms) */
    cycleId: string;
    guildId: string;
    isSkipped: boolean;
    users: {
        // robloxId: string;
        discordId: string;
        /** Whether the role was processed (otherwise user was/ user cmd-skip) */
        roleProcessed: string;
        isMet: boolean;
        isExempt: boolean;
        isExcused: boolean;
        loggedMs: number;
        logsSubmitted: ObjectId[];
        attributes?: any;
    }[];
}
export type IMActivityCycle = { _id: ObjectId } & ActivityCycle;

export interface GuildData {
    _id: string;
    /** A dictionary containing blacklist data. */
    blacklist: {
        /** The status of the blacklist */
        status: boolean;
        /** The blacklist reason */
        reason: string | undefined
    },
    recentCommands: Date[];
    commandLogs: ICommandLog[];
    config: {
        /** Activity log configuration */
        activityLogs: {
            /** Whether the server can use activity logs or not (developer set)*/
            accessEnabled: boolean;
            /** Whether the server uses activity logs or not. */
            enabled: boolean;
            /**
             * Cycle data
             * @important period gets added to cycleEndMs - and that will be the new cycleEndMs to be used (and so on)
             */
            cycle: {
                /** A boolean indicating if the current cycle is being skipped. */
                isSkipped: boolean;
                /** The cycle duration (ms) (e.g. 86400000 assuming it's a day) */
                duration: number;
                /** The cycle's end (e.g. Date.now()) */
                cycleEndMs: number;
            };
            /** The quota */
            quota: ActivityQuota[];
            /** The exact in-game team name that the player needs to be on to start a log */
            team: string;
        },
        /**
         * The role the department uses
         * MNG would be "National Guard," MSP would be "State Police," etc 
         */
        departmentRole: string;
        /** The role given to a user when they're placed on administrative leave. */
        administrativeLeaveRole: string;
        /** The role given to a user when they're suspended. */
        suspendedRole: string;
        /** The role given to a user when they're placed on probation. */
        probationRole: string;
        /** The role given to a user when they're placed on a leave of absence. */
        loaRole: string;
        /** Any patches applied to the data. */
        dataPatches: string[];
        /** Department ranks, from lowest to highest */
        ranks: string[];
        /** Command roles */
        commandRoles: string[];
        /** Department command roles */
        departmentCommandRoles: string[];
        /**
         * Whether to automatically role someone when they're suspended/unsuspended, placed/removed on administrative leave, probation, or a leave of absence.
         * 
         * Probation, suspensions, and LOA automatically de-role someone after a set period of time.
         */
        autoRole: boolean;
        /** Whether to show the Roblox avatar on Department Action messages */
        showAvatarOnActionMessages: boolean;
        /** The department's log channel for action requests. */
        actionRequestChannel: string | boolean;
        /** The department's log channel for activity logs. */
        activityLogChannel: string | boolean;
        /** The department's LOA request channel. */
        loaChannel: string | boolean;
        /** The department log channel  (Channel ID)*/
        logChannel: string | boolean;
        /** The message sent to the user when placed on administrative leave. */
        adminLeaveDM: string;
        /** The message sent in department logs saying who to contact if the subject is seen on-team. */
        adminLeaveContact: string;
        /** Whether discharges show up as `terminated` or `discharged` */
        dischargeDisplay: string;
        /** The custom department icon URL. */
        departmentIconURL: string;
    }
}