import { Redis } from 'ioredis';
import * as Sentry from '@sentry/node';
import Constants from '../Constants';
import noblox from 'noblox.js';
import fetch from 'node-fetch';

type IResult = { robloxId: number, cachedUsername: string, discordId: string, guildId: string }

const BASE_ROVER_URL = 'https://registry.rover.link/api/';

export default async (guildId: string, userId: string, redis: Redis | undefined = undefined, doRefresh: boolean = false): Promise<IResult> => {
    return new Promise(async (resolve, reject) => {
        async function httpFetch(): Promise<IResult> {
            return new Promise(async (resolve1, reject1) => {
                try {
                    const rawResponse = await fetch(BASE_ROVER_URL + `/guilds/${guildId}/discord-to-roblox/${userId}`, {
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ROVER_API_KEY}` }
                    });

                    if (rawResponse.status !== 200) {
                        return reject1(await rawResponse.text());
                    }
                    const json = await rawResponse.json();
                    json.cachedUsername = await noblox.getUsernameFromId(json.robloxId);
                    resolve1(json);
                } catch (Error) {
                    reject(Error);
                }
            });
        }
        try {
            if (!redis) {
                try {
                    const result = await httpFetch();
                    return resolve(result);
                } catch {
                    return reject('1CB');
                }
            }

            redis.get(`${Constants.redisKeys.users}/${userId}`).then(async data => {
                if (data && !doRefresh) {
                    resolve(JSON.parse(data));

                    let result: any;
                    try {
                        result = await httpFetch();
                    } catch {
                        return reject('C1');
                    }
                    if (result) {
                        setTimeout(async () => {
                            redis.psetex(`${Constants.redisKeys.users}/${userId}`, Constants.userRefreshMs, JSON.stringify(result));
                        }, 10);
                    }
                } else {
                    let result: any;
                    try {
                        result = await httpFetch();
                    } catch {
                        return reject('C2');
                    }
                        
                    resolve(result);
                    setTimeout(() => {
                        redis.psetex(`${Constants.redisKeys.users}/${userId}`, Constants.userRefreshMs, JSON.stringify(result)).catch(() => {});
                    }, 10);
                }
            }).catch(async error => {
                if (typeof error === 'object' && error.errorCode === 'user_not_found') return;
                Sentry.captureException(error);
                resolve(await httpFetch());
            });
        } catch (error) {
            reject(error);
        }
    });
}