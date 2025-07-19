import * as Sentry from '@sentry/node';
import fetch, { Response } from 'node-fetch';

const BASE_URL = 'https://api.syntaxical.lol/v1/maylog-activity';

// todo: USE discord-embedbuilder FOR DEV COMMANDS

namespace I {
    export interface Player { team: string; name: string; userId: number; joinedAt: number };
    export interface Server {
        lastKeepAlivePing: number;
        registeredAt: number;
        renewCreate?: boolean;
        serverId: string;
        players: I.Player[]
    }
}

class ActivityAPI {
    constructor() {

    }

    /** Return an array of servers */
    GetServers(): Promise<I.Server[]> {
        return new Promise(async (resolve, reject) => {
            fetch(`${BASE_URL}/servers`, {
                headers: { Authorization: `Bearer ${process.env.ACTIVITY_TOKEN}` }
            }).then(async result => {
                const json = await result.json();
                if (result.status !== 200) return reject(await result.text())
                resolve(json.servers);
            }).catch(error => {
                Sentry.captureException(error);
                reject(error);
            })
        });
    }
    /**
     * Returns server data for the provided server instance
     * @param serverId The Roblox Server ID
     */
    GetServer(serverId: string): Promise<I.Server> {
        return new Promise(async (resolve, reject) => {
            fetch(`${BASE_URL}/${serverId}`, {
                headers: { Authorization: `Bearer ${process.env.ACTIVITY_TOKEN}` }
            }).then(async result => {
                if (result.status !== 200) return reject(await result.text())
                resolve(await result.json());
            }).catch(error => {
                reject(error);
            });
        });
    }
    /**
     * Returns the player object and server object if the player is found in-game.
     * @param userId The Roblox UserId of the player.
     */
    GetPlayerServer(userId: number): Promise<{ server: I.Server, player: I.Player } | void> {
        return new Promise(async (resolve, reject) => {
            try {
                const servers = await this.GetServers();
                servers.forEach(server => {
                    server.players.forEach(player => {
                        if (player.userId === userId) {
                            resolve({ player: player, server: server });
                        }
                    });
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
}

export default new ActivityAPI;