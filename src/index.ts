import { ActivityManager } from './Activity';
import { Colors, GetGuildData, GetRoVerLink } from './util';
import { Errors } from './Enums';
import { GClient, Logger, MessageEmbed } from 'gcommands';
import { Guild, GuildTextBasedChannel } from 'discord.js';
import { GuildData } from './global';
import { join } from 'path';
import { MongoClient } from 'mongodb';
import { oneLine } from 'common-tags';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import Constants from './Constants';
import dotenv from 'dotenv';
import ActivityAPI from './ActivityAPI'; // Ensure this import is correct
import Redis from 'ioredis';

dotenv.config();

// Define the type for color keys
type ColorKey = "mayLOG" | "red" | "pink" | "maroon" | "coral" | "blue" | "dodgerBlue" | "lightBlue" | "steelBlue" | "deepOrange" | "green" | "limeGreen" | "darkAqua" | "lightGreen" | "darkGreen" | "black" | "discordSuccess";

// Check required environment variables
const requiredEnvVars = [
    'MONGO_URI',
    'REDIS_URL',
    Constants.isProduction ? 'DISCORD_PRODUCTION_TOKEN' : 'DISCORD_DEVELOPMENT_TOKEN'
];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});

const mongo = new MongoClient(process.env.MONGO_URI as string, { tlsCAFile: 'certificates/mongodb-maylog.crt' });

const redis = new Redis(process.env.REDIS_URL as string);
const activityManager = new ActivityManager(mongo, redis);

const client = new GClient({
    dirs: [
        join(__dirname, 'commands'),
        join(__dirname, 'events'),
        join(__dirname, 'inhibitors'),
        join(__dirname, 'components')
    ],
    devGuildId: Constants.isProduction ? undefined : Constants.developerGuildId,
    intents: Constants.intents,
    database: { mongo, redis, activityManager }
});

if (Constants.isProduction) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

activityManager.setClient(client);
Logger.setLevel(Logger.TRACE);

async function dbConnect(): Promise<void> {
    try {
        console.log('Connecting to MongoDB...');
        await Promise.race([
            mongo.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000))
        ]);
        console.log('MongoDB connected successfully');
        await mongo.db('maylog').admin().ping();
        console.log('MongoDB ping successful');

        console.log('Connecting to Redis...');
        await Promise.race([
            redis.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 10000))
        ]);
        console.log('Redis connected successfully');
        await redis.ping();
        console.log('Redis ping successful');

        redis.on('error', (error) => {
            if (error.message.includes('ECONNRESET')) return;
            console.error('Redis error:', error);
        });

        redis.on('connect', () => {
            console.log('Redis reconnected');
        });

        redis.on('close', () => {
            console.log('Redis connection closed');
        });

        setInterval(() => {
            redis.ping().catch(error => console.error('Redis ping failed:', error));
        }, 15000);

    } catch (error) {
        console.error('Failed to connect to database:', error);
        if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
            console.error('🚨 DATABASE CONNECTION FAILED:');
            console.error('Make sure MongoDB and Redis are running:');
            console.error('  MongoDB: mongosh (to test connection)');
            console.error('  Redis: redis-cli ping (should return PONG)');
        }
        throw error;
    }
}

class GuildNotification {
    client: GClient;
    guild: Guild;
    embed: MessageEmbed;

    constructor(client: GClient, guild: Guild) {
        this.client = client;
        this.guild = guild;
        this.embed = new MessageEmbed()
            .addFields([
                { name: 'Guild Name', value: guild.name, inline: true },
                { name: 'Guild ID', value: `\`${guild.id}\``, inline: true },
                { name: 'Guild Membercount', value: `${guild.memberCount}`, inline: true }
            ]);
    }

    setType(type: 'CREATE' | 'DELETE' | 'DELETE_BLACKLIST' | 'DELETE_ROVER') {
        const colorMap: Record<string, ColorKey> = {
            'CREATE': 'green',
            'DELETE': 'red',
            'DELETE_BLACKLIST': 'black',
            'DELETE_ROVER': 'red'
        };

        const descriptionMap: Record<string, string> = {
            'CREATE': 'A guild has been created.',
            'DELETE': 'A guild has been deleted.',
            'DELETE_BLACKLIST': 'A **blacklisted** guild has been deleted.',
            'DELETE_ROVER': 'A guild has been deleted; **RoVer was not present.**'
        };

        this.embed
            .setTitle(`${type === 'CREATE' ? 'Guild Created' : 'Guild Deleted'}`)
            .setColor(Colors.getColor(colorMap[type]))
            .setDescription(descriptionMap[type]);

        return this;
    }

    async send() {
        try {
            try {
                const owner = await client.users.fetch(this.guild.ownerId);
                this.embed.addFields({
                    name: 'Guild Owner Discord Account',
                    value: `${owner.username}${owner.discriminator === '0' ? '' : `#${owner.discriminator}`} / \`${owner.id}\``
                });
            } catch {
                this.embed.addFields({
                    name: 'Guild Owner Discord Account',
                    value: `\`${this.guild.ownerId}\``
                });
            }

            try {
                const roverData = await GetRoVerLink(this.guild.id, this.guild.ownerId, redis);
                if (roverData) {
                    this.embed.addFields({
                        name: 'Guild Owner Roblox Account',
                        value: `${roverData.cachedUsername} / \`${roverData.robloxId}\``,
                        inline: true
                    });
                }
            } catch {
                this.embed.addFields({
                    name: 'Guild Owner Roblox Account',
                    value: 'Unavailable',
                    inline: true
                });
            }

            const logChannel = client.guilds.cache.get(Constants.logs.guild_id)?.channels.cache.get(Constants.logs.guild_logs) as GuildTextBasedChannel | undefined;
            if (logChannel) {
                logChannel.send({ content: '@everyone', embeds: [this.embed] }).catch(console.error);
            }
        } catch (error) {
            console.error('Error sending guild notification:', error);
        }
    }
}

(async () => {
    const log = (message: string) => console.log(`${chalk.green('[INFO]')}: ${message}.`);

    try {
        console.log('Starting bot initialization...');
        log('Connecting to database...');
        await dbConnect();

        log('Connected to database. Logging into Discord...');
        console.log('Environment check:');
        console.log('- isProduction:', Constants.isProduction);
        console.log('- Token available:', Constants.isProduction ? (process.env.DISCORD_PRODUCTION_TOKEN ? 'Yes' : 'No') : (process.env.DISCORD_DEVELOPMENT_TOKEN ? 'Yes' : 'No'));

        console.log('Attempting Discord login...');
        await client.login(Constants.isProduction ? process.env.DISCORD_PRODUCTION_TOKEN : process.env.DISCORD_DEVELOPMENT_TOKEN)
            .then(() => {
                log('Logged into Discord. Awaiting ready...');
                console.log('Login successful, waiting for ready event...');
            })
            .catch((error) => {
                console.error(`[${Errors.Connection.Discord}]: Failed to log into Discord:`, error);
                process.exit(1);
            });

        console.log('Setting up event listeners...');
        client.on('ready', () => {
            log(`Logged into Discord as ${client.user!.tag} (${client.user!.id})`);
            log(`Registered ${client.guilds.cache.size} guilds`);
            log(`Registered ${client.users.cache.size} users`);
            client.user!.setPresence(Constants.presenceData);

            setInterval(() => {
                client.guilds.cache.forEach(guild => {
                    GetGuildData(client, guild.id).then(guildData => {
                        if (guildData.blacklist.status) {
                            console.log(`Left blacklisted guild: ${guild.name} (${guild.id})`);
                            temporaryIgnoreGuilds.add(guild.id);
                            guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_BLACKLIST').send());
                        }
                    }).catch(console.error);
                });
            }, Constants.userRefreshMs);
        });

        const temporaryIgnoreGuilds = new Set<string>();

        client.on('guildCreate', guild => {
            GetGuildData(client, guild.id).then(async guildData => {
                if (guildData.blacklist.status) {
                    console.log(`Left blacklisted guild: ${guild.name} (${guild.id})`);
                    temporaryIgnoreGuilds.add(guild.id);
                    guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_BLACKLIST').send());
                    return;
                }

                if (!guild.members.cache.has(Constants.RoVer_Bot_ID)) {
                    console.log(`Left non-RoVer guild: ${guild.name} (${guild.id})`);
                    temporaryIgnoreGuilds.add(guild.id);
                    try {
                        const owner = await guild.members.fetch(guild.ownerId);
                        await owner.send(oneLine`
                            mayLOG was added to your server \`${guild.name}\` (\`${guild.id}\`) but requires RoVer to be present in the server.
                            Please add RoVer at https://rover.link/ and then re-invite mayLOG to your server.`);
                    } catch (error) {
                        console.error('Failed to send message to guild owner:', error);
                    }
                    guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_ROVER').send()).catch(console.error);
                    return;
                }

                console.log(`Created new guild: ${guild.name} (${guild.id})`);
                new GuildNotification(client, guild).setType('CREATE').send();
            }).catch(console.error);
        });

        client.on('guildDelete', guild => {
            if (temporaryIgnoreGuilds.has(guild.id)) {
                temporaryIgnoreGuilds.delete(guild.id);
                return;
            }
            new GuildNotification(client, guild).setType('DELETE').send();
        });

        setInterval(async () => {
            try {
                const guilds = (await mongo.db('maylog').collection('guilds').find<GuildData>({}).toArray())
                    .filter(g => g.config.activityLogs && g.config.activityLogs.enabled);

                if (guilds.length === 0) return;
                console.log(`Processing ${guilds.length} guilds for activity logs`);

                await Promise.all(guilds.map(async guild => {
                    try {
                        const cycle = await activityManager.createCycle(guild, true);
                        await activityManager.submitCycle(cycle);
                    } catch (error) {
                        if (typeof error === 'string' && ['DATE_ERROR', 'ACTIVITY_NOT_ENABLED', 'INVALID_CYCLE'].includes(error)) return;
                        console.error('Error in guild activity cycle:', error);
                        Sentry.captureException(error);
                    }
                }));
            } catch (error) {
                console.error('Error in activity management interval:', error);
                Sentry.captureException(error);
            }
        }, 5000);

        setInterval(async () => {
            try {
                const keys = await redis.keys(`${Constants.redisKeys.logs}/*`);
                if (keys.length === 0) return;
                const results = await redis.mget(...keys);

                await Promise.all(results.map(async key => {
                    if (!key) return;
                    const json = JSON.parse(key);
                    const status = await activityManager.getIngameLogStatus(json.robloxId);
                    if (!status) return;

                    const Server = await ActivityAPI.GetPlayerServer(status.robloxId);
                    const guildData = await GetGuildData(client, status.guildId);
                    const team = guildData.config.activityLogs.team;

                    if (Date.now() >= json.lastKeepAlivePing + Constants.ActivityLogGracePeriod) {
                        try {
                            const guild = client.guilds.cache.get(guildData._id);
                            if (!guild) return;
                            const member = guild.members.cache.find(m => m.id === status.discordId);
                            if (!member) return;
                            const quota = activityManager.getQuotaForMember(guildData, member);
                            if (!quota) return;
                            const isValid = status.duration >= quota.time;
                            await activityManager.endIngameLog(json.robloxId, status, !isValid);
                        } catch (error) {
                            Sentry.captureException(error);
                        }
                    } else {
                        if (!Server || team !== Server.player.team || !status.serverId) return;
                        json.lastKeepAlivePing = Date.now();
                        await redis.psetex(`${Constants.redisKeys.logs}/${json.robloxId}`, 3600 * 6 * 1000, JSON.stringify(json));
                    }
                }));
            } catch (error) {
                Sentry.captureException(error);
            }
        }, 5000);

        process.on('SIGINT', () => {
            console.log('\nReceived SIGINT. Shutting down gracefully...');
            client.destroy();
            mongo.close();
            redis.disconnect();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\nReceived SIGTERM. Shutting down gracefully...');
            client.destroy();
            mongo.close();
            redis.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('Fatal error in main execution:', error);
        process.exit(1);
    }
})();

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled rejection:', error);
});
