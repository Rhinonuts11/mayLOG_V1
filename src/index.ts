import { ActivityManager } from './Activity';
import { Colors, GetGuildData, GetRoVerLink } from './util';
import { Errors } from './Enums'
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
import ActivityAPI from './ActivityAPI';
import Redis from 'ioredis';
dotenv.config();

const mongo = new MongoClient(process.env.MONGO_URI as string);
const redis = new Redis(process.env.REDIS_URL as string, {
    lazyConnect: true,
    reconnectOnError: (error) => {
        console.log(`[${Errors.Connection.Redis}]: Failed to connect to Redis; ${error}`);
        return true;
    }
});
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
    database: { mongo: mongo, redis: redis, activityManager: activityManager }
});
if (Constants.isProduction) Sentry.init({ dsn: process.env.SENTRY_DSN });
activityManager.setClient(client);
Logger.setLevel(Logger.TRACE);

async function dbConnect(): Promise<void> {
    try {
        await mongo.connect();
        await redis.connect();
        redis.on('error', (error: Error) => {
            if (error.message.includes('ECONNRESET')) return;
            console.log(`Redis error:`, error);
        });        
    } catch (error) {
        console.log(`[${Errors.Connection.Mongo}]: Failed to connect to MongoDB: ${error}`);
        process.exit();
    }

    setInterval(() => {
        try {
            redis.ping();
        } catch {}
    }, 15000);

    return Promise.resolve();
}

(async () => {
    const log = (message: string) => console.log(`${chalk.green('[INFO]')}: ${message}.`);
    log(`Connecting to database...`);
    await dbConnect();
    log('Connected to database. Logging into Discord...');

    class GuildNotification {
        client: GClient;
        guild: Guild;
        embed: MessageEmbed;
        constructor(client: GClient, guild: Guild) {
            this.client = client;
            this.guild = guild;
            this.embed = new MessageEmbed()
            .addFields([
                { name: 'Guild Name', value: `${guild.name}`, inline: true },
                { name: 'Guild ID', value: `\`${guild.id}\``, inline: true },
                { name: 'Guild Membercount', value: `${guild.memberCount}`, inline: true }
            ]);
        }
        setType(type: 'CREATE' | 'DELETE' | 'DELETE_BLACKLIST' | 'DELETE_ROVER') {
            if (type === 'CREATE') {
                this.embed
                    .setTitle('Guild Created')
                    .setColor(Colors.getColor('green'))
                    .setDescription('A guild has been created.');
            } else if (type === 'DELETE') {
                this.embed
                    .setTitle('Guild Deleted')
                    .setColor(Colors.getColor('red'))
                    .setDescription('A guild has been deleted.');
            } else if (type === 'DELETE_BLACKLIST') {
                this.embed
                    .setTitle('Guild Deleted')
                    .setColor(Colors.getColor('black'))
                    .setDescription('A **blacklisted** guild has been deleted.')
            } else if (type === 'DELETE_ROVER') {
                this.embed
                    .setTitle('Guild Deleted')
                    .setColor(Colors.getColor('red'))
                    .setDescription('A guild has been deleted; **RoVer was not present.**');
            }
            return this;
        }
        async send() {
            try {
                try {
                    await client.users.fetch(this.guild.ownerId).then(user => {
                        this.embed.addFields({ name: 'Guild Owner Discord Account', value: `${user.username}${user.discriminator === '0' ? '' : `#${user.discriminator}`} / \`${user.id}\`` });
                    }).catch(() => {
                        this.embed.addFields({ name: 'Guild Owner Discord Account', value: `\`${this.guild.ownerId}\`` });
                    })
                } catch {}
                try {
                    const roverData = await GetRoVerLink(this.guild.id, this.guild.ownerId, redis);
                    if (roverData) {
                        this.embed.addFields({ name: 'Guild Owner Roblox Account', value: `${roverData.cachedUsername} / \`${roverData.robloxId}\``, inline: true });
                    }
                } catch {
                    this.embed.addFields({ name: 'Guild Owner Roblox Account', value: 'Unavailable', inline: true })
                }
            } catch {}
            const logChannel = client.guilds.cache.get(Constants.logs.guild_id)?.channels.cache.get(Constants.logs.guild_logs) as GuildTextBasedChannel | undefined;
            if (logChannel) {
                logChannel.send({ content: '@everyone', embeds: [ this.embed ] }).catch(() => {});
            }
        }
    }

    client.login(Constants.isProduction ? process.env.DISCORD_PRODUCTION_TOKEN : process.env.DISCORD_DEVELOPMENT_TOKEN)
        .then(() => log('Logged into Discord. Awaiting ready...'))
        .catch((error) => console.log(`[${Errors.Connection.Discord}]: Failed to log into Discord: ${error}`));

    client.on('ready', () => {
        log(`Logged into Discord as ${client.user!.tag} (${client.user!.id})`);
        log(`Registered ${client.guilds.cache.size} guilds`);
        log(`Registered ${client.users.cache.size} users`);

        client.user!.setPresence(Constants.presenceData);

        setInterval(() => {
            for (const guild of client.guilds.cache.values()) {
                GetGuildData(client, guild.id).then(guildData => {
                    if (guildData.blacklist.status) {
                        console.log(`Left blacklisted guild: ${guild.name} (${guild.id})`);
                        temporaryIgnoreGuilds.add(guild.id);
                        guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_BLACKLIST').send());
                        return;
                    }
                }).catch(() => {});
            }
        }, Constants.userRefreshMs);
    });
    
    const temporaryIgnoreGuilds = new Set<string>();
    client.on('guildCreate', guild => {
        GetGuildData(client, guild.id).then(async guildData => {
            if (guildData.blacklist.status) {
                console.log(`Left blacklisted guild: ${guild.name} (${guild.id})`);
                temporaryIgnoreGuilds.add(guild.id);
                guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_BLACKLIST').send())
                return;
            }
            if (!guild.members.cache.has(Constants.RoVer_Bot_ID)) {
                console.log(`Left non-RoVer guild: ${guild.name} (${guild.id})`);
                temporaryIgnoreGuilds.add(guild.id);
                await guild.members.fetch(guild.ownerId)
                    .then(async member => {
                        try {
                            await member.send(oneLine`
                            mayLOG was added to your server \`${guild.name}\` (\`${guild.id}\`) but requires RoVer to be present in the server.
                            Please add RoVer at https://rover.link/ and then re-invite mayLOG to your server.`)
                        } catch {}
                    }).catch(() => {});
                guild.leave().then(() => new GuildNotification(client, guild).setType('DELETE_ROVER').send()).catch(() => {});
                return;
            }
            console.log(`Created new guild: ${guild.name} (${guild.id})`);
            new GuildNotification(client, guild).setType('CREATE').send();
        }).catch(() => {});
    });

    client.on('guildDelete', guild => {
        if (temporaryIgnoreGuilds.has(guild.id)) {
            temporaryIgnoreGuilds.delete(guild.id);
            return;
        }
        new GuildNotification(client, guild).setType('DELETE').send();
    });

    setInterval(async () => {
        const guilds = (await mongo.db('maylog')
            .collection('guilds').find<GuildData>({})
            .toArray()).filter(g => (g.config.activityLogs && g.config.activityLogs.enabled));
        if (guilds.length === 0) return;

        guilds.forEach(async guild => {
            activityManager.createCycle(guild, true).then(cycle => {
                activityManager.submitCycle(cycle).catch(error => {
                    Sentry.captureException(error);
                });
            }).catch(error => {
                if (error === 'DATE_ERROR') return;
                if (error === 'ACTIVITY_NOT_ENABLED') return;
                if (error === 'INVALID_CYCLE') return;
                Sentry.captureException(error);
            });
        });
    }, 5000);

    setInterval(async () => {
        try {
            const keys = await redis.keys(`${Constants.redisKeys.logs}/*`);
            if (keys.length === 0) return;
            const results = await redis.mget(...keys);
            results.forEach(async key => {
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
                        const isValid = status.duration >= quota.time
                        await activityManager.endIngameLog(json.robloxId, status, !isValid);
                    } catch (error) {
                        Sentry.captureException(error);
                    }
                } else {
                    if (!Server) return;
                    if (team !== Server.player.team) return;
                    if (!status.serverId) return;
                    json.lastKeepAlivePing = Date.now();
                    redis.psetex(`${Constants.redisKeys.logs}/${json.robloxId}`, 3600 * 6 * 1000, JSON.stringify(json));
                }
            });
        } catch (error) {
            Sentry.captureException(error);
        }
    }, 5000);
})();

process.on('uncaughtException', error => {
    console.log(`Uncaught exception: ${error}`);
});
process.on('unhandledRejection', error => {
    console.log(`Unhandled rejection: ${error}`);
});