import { ActivityQuota, GuildData, ICommandLog } from './global';
import { PresenceData } from 'discord.js';
import { stripIndents } from 'common-tags';

const ENDPOINT_PREFIX = process.platform === 'win32' ? 'http://localhost:10001' : 'https://[redacted]'

// todo: in-game Dashboard for mayLOG
export default {
    /** A boolean indicating if the system is in production or not */
    isProduction: process.platform !== 'win32',
    /** Re-archive members every period (ms)*/
    userRefreshMs: 3600 * 6 * 1000,
    /** Activity endpoint */
    Activity_Endpoint: process.env.ACTIVITY_API_URL ? `${process.env.ACTIVITY_API_URL}/v1/maylog-activity/servers/relay/create` : `${ENDPOINT_PREFIX}/v1/maylog-activity/servers/relay/create`,
    /** The Discord User ID for the RoVer bot. */
    RoVer_Bot_ID: '298796807323123712',
    /**
     * Grace period (MILLISECONDS) before a log submits if the user isn't found in-game (3 minutes)
     */
    ActivityLogGracePeriod: 3 * 60 * 1000,
    /** Emojis */
    emojis: {
        /** Authorized/success (displays a check in a box) */
        authorized: '<:authorized:884909716269056060>',
        /** Check */
        check: '<:check:884940684455477249>',
        /** X icon */
        x: '<:x_:884940684832944168>',
        /** Rules */
        rules: '<:rules:884909716311011328>'
    },
    /** Logging channels */
    logs: {
        /** Guild ID */
        guild_id: '1096635116282978375',
        /** Log channel for guild joins and leaves. */
        guild_logs: '1110012970899079219',
        /** Log channel for bug reports */
        bug_reports: '1119710523232096306',
        /** Log channel for suggestions */
        suggestions: '1119710538977525791'
    },
    /** Discord intents */
    intents: 299,
    presenceData: <PresenceData>{
        status: 'online',
        activities: [ { type: 'PLAYING', name: 'with department logs' } ]
    },
    /** Unused  */
    developerIds: [ '212772501141323776' ],
    developerGuildId: '1096635116282978375',
    inviteLinks: {
        production: 'https://discord.com/api/oauth2/authorize?client_id=1096613340714893362&permissions=268486672&scope=bot%20applications.commands',
        development: 'https://discord.com/api/oauth2/authorize?client_id=1103589105725624383&permissions=268486672&scope=bot%20applications.commands'
    },
    /** `Contact X if seen on team type` messages */
    AdminLeaveMessages: {
        /** IA + High Command */
        IA_HC: 'Contact IA Command and High Command if seen on-team.',
        /** Department Command */
        DC: 'Contact Department Command if seen on-team',
        /** HR + DC */
        HR_DC: 'Contact Human Resources and Department Command if seen on-team.',
        /** MP + MIS */
        MP_MIS: 'Contact MP and MIS if seen on-team.',
        /** AOD * HC */
        AOD_HC: 'Contact the Administrative Operations Director or High Command if seen on-team.',
    },
    redisKeys: {
        /** Guilds key */
        guild: 'maylog/guilds',
        /** Users key */
        users: 'maylog/users',
        /** Key for active activity logs */
        logs: 'maylog/activity-logs'
    },
    DefaultLogChannel: 'department-logs',
    GameTeams: [
        `None`, `Citizen`, `Fire Department`, `Lander Police Department`, `Mayflower National Guard`,
        `Mayflower Parks & Wildlife`, `Mayflower Postal Service`, `Mayflower State Police`,
        `New Haven Transit Authority`, `Plymouth Police Department`, `Public Broadcasting Service`,
        `Sheriff's Office`, `United Central Railroad`
    ],
    BlankGuild: <GuildData>{
        blacklist: { status: false, reason: undefined },
        recentCommands: [] as Date[],
        commandLogs: [] as ICommandLog[],
        config: {
            activityLogs: {
                accessEnabled: false,
                enabled: false,
                quota: [] as ActivityQuota[],
                cycle: {
                    isSkipped: false,
                    duration: 0,
                    cycleEndMs: 0
                },
                team: ''
            },
            dataPatches: [] as string[],
            ranks: [] as string[],
            commandRoles: [] as string[],
            departmentCommandRoles: [] as string[],
            departmentRole: '',
            administrativeLeaveRole: '',
            loaRole: '',
            suspendedRole: '',
            probationRole: '',
            autoRole: false,
            showAvatarOnActionMessages: false,
            activityLogChannel: false,
            actionRequestChannel: false,
            loaChannel: false,
            logChannel: false,
            departmentIconURL: '',
            adminLeaveContact: 'IA_HC',
            dischargeDisplay: 'terminate',
            adminLeaveDM: stripIndents`
                You have been placed on **administrative leave**. During this time, you may not get on-team, represent the department, attend events, or conduct any of your duties.

                An investigator assigned to your case will DM you shortly. Any questions may be directed to the Internal Affairs Head or investigator assigned to your case.
            `,
        }
    }
}