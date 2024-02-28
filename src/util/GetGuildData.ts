import { Database, GuildData } from '../global';
import { GClient } from 'gcommands';
import Constants from '../Constants';

/**
 * @param  {GClient} client
 * @param  {string} guildId
 * @param  {boolean} forceRefresh Refresh with MongoDB data instead of using the Redis cache?
 * @returns Promise
 */
export default async (client: GClient, guildId: string, forceRefresh: boolean = false): Promise<GuildData> => {
    return new Promise((resolve, reject) => {
        const { mongo, redis } = client.getDatabase<Database>();

        function fetchMongo() {
            mongo.db('maylog').collection('guilds').findOne<GuildData>({ _id: guildId }).then(guild => {
                if (guild) {
                    const guildData = Object.assign({}, Constants.BlankGuild, guild);
                    guildData.config = Object.assign({}, Constants.BlankGuild.config, guild.config);
                    resolve(guildData);
                } else resolve(structuredClone(Constants.BlankGuild));
            }).catch(reject);
        }

        if (forceRefresh || !Constants.isProduction) return fetchMongo();
        redis.get(`${Constants.redisKeys.guild}/${guildId}`).then(guildString => {
            if (!guildString || forceRefresh) {
                fetchMongo();
            } else {
                resolve(JSON.parse(guildString));
            }
        });
    });
}