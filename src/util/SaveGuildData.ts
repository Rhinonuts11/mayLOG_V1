import { Database, GuildData } from '../global';
import { GClient } from 'gcommands';
import Constants from '../Constants';

/**
 * Set guild data
 * @param  {GClient} client
 * @param  {string} guildId
 * @param  {GuildData} Guild data
 * @returns Promise
 */
export default async (client: GClient, guildId: string, data: GuildData): Promise<void> => {
    return new Promise((resolve, reject) => {
        const { mongo, redis } = client.getDatabase<Database>();

        const promises = [
            mongo.db('maylog').collection('guilds').updateOne({ _id: guildId }, { $set: data }, { upsert: true }),
            redis.setex(`${Constants.redisKeys.guild}/${guildId}`, 3600, JSON.stringify(data))
        ]

        Promise.all(promises).then(() => resolve()).catch(reject);
    });
}