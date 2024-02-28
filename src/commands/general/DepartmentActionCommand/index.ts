import { Argument, ArgumentType, Command, CommandContext, CommandType, MessageButton, MessageEmbed } from 'gcommands';
import { Colors, GetGuildData, GetRoVerLink } from '../../../util';
import { Database } from '../../../global';
import { GuildMember, Interaction, InteractionCollector, MessageActionRow, TextChannel } from 'discord.js';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import actionList from './actionList';
import CommandInhibitor from '../../../inhibitors/CommandInhibitor';
import Constants from '../../../Constants';
import noblox from 'noblox.js';
import uniqueActions from './uniqueActions';

const PROMPTS = {
    subject: 'Who is subjected to this action? (@Mention/Username/#UserId)',
    notes: 'What are the notes for this action?',
    accept: { descriotion: 'Log a department acceptance.' },
    admin_leave: { description: 'Log a user\'s placement on administrative leave.' },
    remove_admin: { description: 'Log a removal from administrative leave.' },
    probation: {
        description: 'Log a probationary period.',
        expiration: 'When will probation end?'
    },
    remove_probation: { description: 'Log the end of a probationary period.' },
    verbal_warning: { description: 'Log a verbal warning.' },
    recorded_warning: { description: 'Log a recorded warning.' },
    suspension: {
        description: 'Log a suspension.',
        expiration: 'When will the suspension end?',
    },
    unsuspend: { description: 'Log the end of a suspension' },
    promote: {
        description: 'Log a promotion.',
        rank: 'What rank is the user being promoted to?',
        division: 'What division is the user being promoted in?',
    },
    demote: {
        description: 'Log a demotion.',
        rank: 'What rank is the user being demoted to?',
        division: 'What division is the user being demoted in?'
    },
    transfer: {
        description: 'Log a division transfer',
        division: 'What division is the user transferring to?'
    },
    transfer_promote: {
        description: 'Log a transfer and promotion.',
        rank: 'What rank is the user being promoted to?',
        division: 'What division is the user transferring to?'
    },
    transfer_demote: {
        description: 'Log a transfer and demotion.',
        rank: 'What rank is the user being demoted to?',
        division: 'What division is the user transferring to?'
    },
    discharge: {
        description: 'Log a discharge.',
        type: 'What is the discharge type?'
    },
    blacklist: {
        description: 'Log a department blacklist.',
        type: 'What is the blacklist type?'
    },
    loa: {
        description: 'Log a leave of absence.',
        expiration: 'When does the leave of absence end?'
    },
    remove_loa: {
        description: 'Log the end of a leave of absence.'
    },
    custom: {
        description: 'Log a custom action.',
        message: 'What\'s the message?',
        preset_color: 'What color should be used? (preset)',
        hex_color: 'What color should be used? (HEX)'
    }
}

interface ICommandData {
    executor: { username: string, user_id: number };
    subject?: { username: string; user_id: number, discord_user?: GuildMember };
}

const ARGSUBJECT = () => new Argument({
    name: 'subject',
    type: ArgumentType.STRING,
    description: PROMPTS.subject,
    required: true
});

const ARGNOTES = () => new Argument({
    name: 'notes',
    description: PROMPTS.notes,
    maxLength: 300,
    type: ArgumentType.STRING
});


function getUserFromMention(mention: string): string | void {
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return mention;
	}
}

async function fetchCommandData(context: CommandContext, subject?: string): Promise<ICommandData> {
    const redis = context.client.getDatabase<Database>().redis;
    return new Promise(async (resolve, reject) => {
        let subjectData: { username: string, user_id: number, discord_user?: GuildMember } | undefined = undefined;
        let executorData: { username: string, user_id: number } | undefined = undefined;
        const promises = [
            new Promise<void>(async resolve => {
                try {
                    const userData = await GetRoVerLink(context.guild!.id, context.user.id, redis);
                    executorData = { username: userData.cachedUsername, user_id: userData.robloxId };
                    resolve();
                } catch {
                    resolve();
                }
            }),
            new Promise<void>(async resolve => {
                if (!subject) return resolve();

                if (subject.includes('@')) {
                    const user = getUserFromMention(subject);
                    if (!user) return resolve();
                    const member = context.guild!.members.cache.get(user);
                    if (!member) return resolve();

                    try {
                        const userData = await GetRoVerLink(context.guild!.id, member.user.id, redis);
                        subjectData = { username: userData.cachedUsername, user_id: userData.robloxId, discord_user: member! };
                        resolve();
                    } catch {
                        resolve();
                    }
                } else if (subject.startsWith('#')) {
                    const userId = subject.slice(1, subject.length);

                    noblox.getUsernameFromId(Number(userId)).then(username => {
                        if (!username) return resolve();
                        subjectData = { username: username, user_id: Number(userId) };
                        resolve();
                    }).catch(() => resolve());
                } else {
                    if (subject.length >= 3 && subject.length <= 20) {
                        noblox.getIdFromUsername(subject).then(id => {
                            if (!id) return resolve();
                            noblox.getUsernameFromId(id).then(username => {
                                subjectData = { username: username, user_id: id };
                                resolve();
                            }).catch(() => resolve());
                        }).catch(() => resolve());
                    } else {
                        resolve();
                    }
                }
            })
        ];
        try {
            await Promise.all(promises);
        } catch {} finally {
            if (!executorData) return reject();
            if (!subjectData && subject) return reject();
            resolve({ executor: executorData, subject: subjectData });
        }
    });
}

new Command({
    name: 'deptaction',
    description: 'Log a department action.',
    type: [ CommandType.SLASH ],
    inhibitors: [ new CommandInhibitor() ],
    dmPermission: false,
    arguments: [
        new Argument({
            name: 'accept',
            description: PROMPTS.accept.descriotion,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'admin_leave',
            description: PROMPTS.admin_leave.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES(),
                new Argument({
                    name: 'no_dm',
                    description: "Don't send a DM to the target user?",
                    type: ArgumentType.STRING,
                    choices: [ { name: 'Do not send a DM.', value: 'no_dm' } ]
                })
            ]
        }),
        new Argument({
            name: 'remove_admin',
            description: PROMPTS.remove_admin.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'probation',
            description: PROMPTS.probation.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'expiration',
                    type: ArgumentType.STRING,
                    description: PROMPTS.probation.expiration,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'remove_probation',
            description: PROMPTS.remove_probation.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'verbal_warning',
            description: PROMPTS.verbal_warning.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'recorded_warning',
            description: PROMPTS.recorded_warning.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'suspension',
            description: PROMPTS.suspension.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'expiration',
                    type: ArgumentType.STRING,
                    description: PROMPTS.suspension.expiration,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'unsuspend',
            description: PROMPTS.unsuspend.description,
            type: ArgumentType.SUB_COMMAND, // todo: [1.9/1.10] implement automatic unsuspension messages (via prompt)
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'promote',
            description: PROMPTS.promote.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'rank',
                    description: PROMPTS.promote.rank,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'division',
                    description: PROMPTS.promote.division,
                    type: ArgumentType.ROLE,
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'demote',
            description: PROMPTS.demote.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'rank',
                    description: PROMPTS.demote.rank,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'division',
                    description: PROMPTS.demote.division,
                    type: ArgumentType.ROLE,
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'transfer',
            description: PROMPTS.transfer.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'division',
                    description: PROMPTS.transfer.division,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'transfer_promote',
            description: PROMPTS.transfer_promote.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'rank',
                    description: PROMPTS.transfer_promote.rank,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'division',
                    description: PROMPTS.transfer_promote.division,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'transfer_demote',
            description: PROMPTS.transfer_demote.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'rank',
                    description: PROMPTS.transfer_demote.rank,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                new Argument({
                    name: 'division',
                    description: PROMPTS.transfer_demote.division,
                    type: ArgumentType.ROLE,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'discharge',
            description: PROMPTS.discharge.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'type',
                    description: PROMPTS.discharge.type,
                    required: true,
                    type: ArgumentType.STRING,
                    choices: [
                        { name: 'Honorable', value: 'honorable' },
                        { name: 'Dishonorable', value: 'dishonorable' },
                        { name: 'General', value: 'general' },
                        { name: 'Preliminary', value: 'preliminary' }
                    ]
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'blacklist',
            description: PROMPTS.blacklist.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'type',
                    description: PROMPTS.blacklist.type,
                    required: true,
                    type: ArgumentType.STRING,
                    choices: [
                        { name: 'Permanent blacklist', value: 'permanent' },
                        { name: 'General blacklist', value: 'general' },
                        { name: 'Temporary blacklist', value: 'temporary' }
                    ]
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'loa',
            description: PROMPTS.loa.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                new Argument({
                    name: 'expiration',
                    type: ArgumentType.STRING,
                    description: PROMPTS.loa.expiration,
                    required: true
                }),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'remove_loa',
            description: PROMPTS.remove_loa.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                ARGSUBJECT(),
                ARGNOTES()
            ]
        }),
        new Argument({
            name: 'custom',
            description: PROMPTS.custom.description,
            type: ArgumentType.SUB_COMMAND,
            arguments: [
                new Argument({
                    name: 'message',
                    type: ArgumentType.STRING,
                    description: PROMPTS.custom.message,
                    maxLength: 500,
                    required: true
                }),
                new Argument({
                    name: 'preset_color',
                    type: ArgumentType.STRING,
                    description: PROMPTS.custom.preset_color,
                    choices: Colors.getColorList().map(m => { return { name: m, value: m } })
                }),
                new Argument({
                    name: 'hex_color',
                    type: ArgumentType.STRING,
                    description: PROMPTS.custom.hex_color,
                }),
                ARGNOTES()
            ]
        })
    ],
    async run(context) {
        try {
            await context.deferReply({ ephemeral: true });
        } catch { return };
        try {
            const db = context.client.getDatabase<Database>();
            const subCommand = context.arguments.getSubcommand();
            const subject = context.arguments.getString('subject')!;
            const notes = context.arguments.getString('notes')!;
            let cmdData: ICommandData;
            try {
                cmdData = await fetchCommandData(context, subject);
            } catch {
                context.editReply('I could not fetch the executor or subject. Is your Roblox account linked? Did you use the correct subject?');
                return;
            }
            const GuildData = await GetGuildData(context.client, context.guild!.id);
            const embed = new MessageEmbed()
                .setTitle('Department Action')
                .setFooter({
                    text: cmdData.executor.username,
                    iconURL: GuildData.config.departmentIconURL === '' ? context.guild!.iconURL()! : GuildData.config.departmentIconURL
                });
            
            if (notes) embed.addFields({ name: 'Notes', value: notes });
            if (GuildData.config.showAvatarOnActionMessages) {
                try {
                    const id = cmdData.subject?.user_id;
                    if (id) {
                        const avatar = await noblox.getPlayerThumbnail(id, '50x50', 'png', false, 'headshot');
                        const result = avatar[0].imageUrl;
                        if (result) embed.setThumbnail(result);
                    }
                } catch {}
            }

            const actionKey = subCommand as keyof typeof actionList;
            const runAction = actionList[actionKey];
            try {
                runAction({ context: context, guild: GuildData, embed: embed, subject: cmdData.subject! });
            } catch (error: any) {
                if (error.message) {
                    if ((error.message as string).startsWith('$$')) {
                        return context.editReply((error.message as string).replace('$$', ''));
                    } else {
                        Sentry.captureException(error);
                        return context.editReply('An error occurred.');
                    }
                } else {
                    Sentry.captureException(error);
                    return context.editReply('An error occurred.');
                }
            }

            const uuid = randomUUID();
            const ConfirmButton = new MessageButton()
                .setCustomId(`confirm-${uuid}`)
                .setLabel('Confirm')
                .setStyle('SUCCESS');
            const RejectButton = new MessageButton()
                .setCustomId(`reject-${uuid}`)
                .setLabel('Reject')
                .setStyle('DANGER');
            const row = new MessageActionRow<MessageButton>().addComponents(ConfirmButton, RejectButton);
            const message = await context.editReply({ content: 'Please confirm if this is correct', components: [ row ], embeds: [ embed ] });

            let isProcessed = false;
            const filter = (i: Interaction) => {
                if (!i.isButton()) return false;
                if (i.message.id !== message.id) return false;
                if (![ `confirm-${uuid}`, `reject-${uuid}`].includes(i.customId)) return false;
                return i.user.id === context.user.id;
            }

            const collector = new InteractionCollector(context.client, { filter, idle: 30000 });
            const editReply = (message: string | MessageEmbed[], clearEmbeds: boolean = true) => {
                const messageData: { content?: string | null, components: [], embeds?: [] | MessageEmbed[] } = { components: [] };
                if (clearEmbeds) messageData.embeds = [];
                if (typeof message === 'string') {
                    messageData.content = message;
                } else {
                    messageData.content = null;
                    messageData.embeds = message;
                }
                return context.editReply(messageData);
            }

            collector.on('collect', async interaction => {
                if (!interaction.isButton()) return;
                if (isProcessed) return;
                isProcessed = true;
                collector.stop();
                if (interaction.customId === `reject-${uuid}`) {
                    editReply('Cancelled.');
                    return;
                }

                const logChannel = context.guild!.channels.cache.find(channel => {
                    if (GuildData.config.logChannel) {
                        return channel.id === GuildData.config.logChannel as string;
                    } else {
                        return channel.name == Constants.DefaultLogChannel;
                    }
                }) as TextChannel | undefined;
                if (!logChannel) {
                    editReply('No department log channel was found. You can set a default `#department-logs` channel or use `/config set-log-channel` to set one.');
                    return;                    
                }

                editReply('Processing...');

                logChannel.send({ embeds: [embed] }).then(async message => {
                    try {
                        const messageLink = `https://discord.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`;
                        editReply(`${Constants.emojis.authorized} Successfully logged department action: ${messageLink}`);
                        setTimeout(() => {
                                db.mongo.db('maylog').collection('guild-activity').updateOne({ _id: context.guild!.id }, {
                                    $addToSet: { recentCommands: new Date() }
                                }, { upsert: true }).catch(() => {});
                                // db.mongo.db('maylog').collection('guilds').updateOne({ _id: context.guild!.id }, {
                                //     $addToSet: { commandLogs: Object.assign({}, actionData, { ts: new Date() }) }
                                // }).catch(() => {});
                        }, 10);
                        try {
                            const uniqueActionFn = uniqueActions[subCommand as keyof typeof uniqueActions];
                            if (uniqueActionFn) {
                                await uniqueActionFn({ context: context, guild: GuildData, embed: embed, subject: cmdData.subject!, extra: { executor: cmdData.executor, discordSubject: cmdData.subject!.discord_user } });
                            }
                        } catch (error) {
                            Sentry.captureException(error);
                            context.followUp({ ephemeral: true, content: 'I tried performing a unique action (e.g. giving a role out) but it failed.' });
                        }
                    } catch (error) {
                        Sentry.captureException(error);
                        console.log(error);
                    }
                }).catch(() => editReply('An error occurred while trying to log the department action. Do I have the `Send Messages` permission?'));
            });
            collector.on('end', interactions => {
                if (isProcessed) return;
                isProcessed = true;
                if (interactions.size === 0) {
                    editReply('Timed out.');
                } else {
                    editReply('An unexpected error occurred. EC C3A');
                }
                return;
            });
            // context.editReply(`${cmdData.executor.username}; ${cmdData.subject?.username}`)
        } catch (error) {
            // Sentry.captureException(error);
            console.log(error)
            context.safeReply('An error occurred. EC F9A');
        }
        return
    }
    // async run2(context) {
    //     await context.deferReply({ ephemeral: true });
    //     try {
    //         const db = context.client.getDatabase<Database>();
    //         const subCommand = context.arguments.getSubcommand();
    //         let discordSubject: GuildMember | undefined;
    //         let subjectError: string | undefined;
    //         const subject = await (async () => {
    //             return new Promise<{ name: string, id: number } | void>(async (resolve) => {
    //                 try {
    //                     const subjectStr = context.arguments.getString('subject');
    //                     if (!subjectStr) return resolve();
                        
    //                     const error = (type: any, e: any = false) => {
    //                         if (e) Sentry.captureException(e);
    //                         subjectError = type;
    //                         resolve();
    //                     }

    //                     if (subjectStr.includes('@')) {
    //                         const user = getUserFromMention(subjectStr);
    //                         if (!user) return error('MENTION');
    //                         discordSubject = context.guild!.members.cache.get(user);
    //                         if (discordSubject) {
    //                             const userData = await GetRoVerLink(context.guild!.id, discordSubject.user.id, db.redis);
    //                             resolve({ name: userData.cachedUsername, id: userData.robloxId });
    //                         } else error('MENTION'); // Error
    //                     } else if (subjectStr.startsWith('#')) {
    //                         const userId = subjectStr.slice(1, subjectStr.length);
    //                         noblox.getUsernameFromId(Number(userId)).then(username => {
    //                             resolve({ name: username, id: Number(userId) });
    //                         }).catch(e => error('USERID', e));
    //                     } else {
    //                         if (subjectStr.length >= 3 && subjectStr.length <= 20) {
    //                             noblox.getIdFromUsername(subjectStr).then(id => {
    //                                 if (!id) return error('USERNAME');
    //                                 noblox.getUsernameFromId(id).then(username => {
    //                                     resolve({ name: username, id: id });
    //                                 }).catch(e => error('GENERAL', e));
    //                             }).catch(e => error('USERNAME', e));
    //                         } else error('USERNAME');
    //                     }
    //                 } catch (error) {
    //                     Sentry.captureException(error);
    //                     subjectError = 'GENERAL';
    //                     resolve();
    //                 }
    //             });
    //         })();
    //         const executor = await (async () => {
    //             return new Promise<{ discord: GuildMember, roblox: { name: string, id?: number } }>(async (resolve, reject) => {
    //                 const member = context.guild!.members.cache.get(context.member!.user.id)!
    //                 try {
    //                     const userData = await GetRoVerLink(context.guild!.id, context.user.id, db.redis);
    //                     resolve({ discord: member, roblox: { name: userData.cachedUsername, id: userData.robloxId } });
    //                 } catch (error) {
    //                     console.log(error);
    //                     Sentry.captureException(error);
    //                     resolve({ discord: member, roblox: { name: member.displayName } })
    //                 }
    //             });
    //         })();
    //         const notes = () => context.arguments.getString('notes')!;
    //         // if (!subject && !subjectError) return context.editReply('An error occurred while trying to obtain the subject.');
    //         if (subjectError) {
    //             if (subjectError === 'USERNAME') {
    //                 context.editReply('An error occurred while trying to fetch data for that Roblox username. Did you provide a correct username?');
    //             } else if (subjectError === 'USERID') {
    //                 context.editReply('An error occurred while trying to parse the UserId. Did you provide a valid UserId?');
    //             } else if (subjectError === 'MENTION') {
    //                 context.editReply('An error occurred while trying to parse the mention. Did you provide a correct mention? Is the user you wanted to mention in the server?');
    //             } else if (subjectError === 'GENERAL') {
    //                 context.editReply('An error ocurred while executing this command.');
    //             }
    //             return;
    //         }
    //         const guild = await GetGuildData(context.client, context.guild!.id);
    //         const embed = new MessageEmbed()
    //             .setTitle('Department Action')
    //             .setFooter({
    //                 text: executor.roblox.name,
    //                 iconURL: guild.config.departmentIconURL === '' ? context.guild!.iconURL()! : guild.config.departmentIconURL
    //             });
            
    //         if (notes()) embed.addFields({ name: 'Notes', value: notes() });
    //         if (guild.config.showAvatarOnActionMessages) {
    //             try {
    //                 const id = subject!.id ? subject!.id as number : await noblox.getIdFromUsername(subject!.name);
    //                 const avatar = await noblox.getPlayerThumbnail(id, '50x50', 'png', false, 'headshot');
    //                 const result = avatar[0].imageUrl;
    //                 if (result) {
    //                     embed.setThumbnail(result);
    //                 }
    //             } catch {}
    //         }

    //         const actionKey = subCommand as keyof typeof actionList;
    //         const runAction = actionList[actionKey];
    //         const actionData = { action: actionKey, subject: subject!, arguments: [] };
    //         try {
    //             runAction({ context: context, guild: guild, embed: embed, subject: subject! });
    //         } catch (error: any) {
    //             if (error.message) {
    //                 if ((error.message as string).startsWith('$$')) {
    //                     return context.editReply((error.message as string).replace('$$', ''));
    //                 } else {
    //                     Sentry.captureException(error);
    //                     return context.editReply('An error occurred.');
    //                 }
    //             } else {
    //                 Sentry.captureException(error);
    //                 return context.editReply('An error occurred.');
    //             }
    //         }
    //         const uuid = randomUUID();
    //         const argTable: any[] = [];
    //         context.arguments.data[0].options!.forEach(option => argTable.push({ name: option.name, type: option.type, value: option.value }));
    //         Object.assign(actionData, { arguments: argTable });

    //         const ConfirmButton = new MessageButton()
    //             .setCustomId(`confirm-${uuid}`)
    //             .setLabel('Confirm')
    //             .setStyle('SUCCESS');
    //         const RejectButton = new MessageButton()
    //             .setCustomId(`reject-${uuid}`)
    //             .setLabel('Reject')
    //             .setStyle('DANGER');
    //         const row = new MessageActionRow<MessageButton>().addComponents(ConfirmButton, RejectButton);
    //         const message = await context.editReply({ content: 'Please confirm this is correct.', components: [ row ], embeds: [ embed ] });

    //         const filter = (i: Interaction) => {
    //             if (!i.isButton()) return false;
    //             if (i.message.id !== message.id) return false;
    //             if (![ `confirm-${uuid}`, `reject-${uuid}` ].includes(i.customId)) return false;
    //             return i.user.id == context.user.id;
    //         }

    //         const collector = new InteractionCollector(context.client, { filter, idle: 30000 });
    //         const editReply = (message: string | MessageEmbed[], clearEmbeds: boolean = true) => {
    //             const messageData: { content?: string | null, components: [], embeds?: [] | MessageEmbed[] } = { components: [] };
    //             if (clearEmbeds) messageData.embeds = [];
    //             if (typeof message === 'string') {
    //                 messageData.content = message;
    //             } else {
    //                 messageData.content = null;
    //                 messageData.embeds = message;
    //             }
    //             return context.editReply(messageData);
    //         }

    //         collector.on('collect', async interaction => {
    //             collector.stop();
    //             if (!interaction.isButton()) return;
    //             if (interaction.customId === `reject-${uuid}`) {
    //                 editReply('Cancelled');
    //                 return;
    //             }
    //             setTimeout(async () => {
    //                 try {
    //                     const uniqueActionFn = uniqueActions[subCommand as keyof typeof uniqueActions];
    //                     if (uniqueActionFn) await uniqueActionFn({ context: context, guild: guild, embed: embed, subject: subject!, extra: { executor, discordSubject }});
    //                 } catch (error) {
    //                     Sentry.captureException(error);
    //                     // todo: add better handling here
    //                 }
    //             }, 1000);

    //             const logChannel = context.guild!.channels.cache.find(channel => {
    //                 if (guild.config.logChannel) {
    //                     return channel.id === guild.config.logChannel as string;
    //                 } else {
    //                     return channel.name == Constants.DefaultLogChannel;
    //                 }
    //             }) as TextChannel | undefined;
    //             if (!logChannel) {
    //                 editReply('No department log channel was found. You can set a default `#department-logs` channel or use `/config set-log-channel` to set one.');
    //                 return;
    //             }
    //             logChannel.send({ embeds: [ embed ] }).then(message => {
    //                 try {
    //                     const messageLink = `https://discord.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`;
    //                     editReply(`${Constants.emojis.authorized} Successfully logged department action: ${messageLink}`);
    //                     setTimeout(() => {
    //                             db.mongo.db('maylog').collection('guild-activity').updateOne({ _id: context.guild!.id }, {
    //                                 $addToSet: { recentCommands: new Date(), commandLogs: Object.assign({}, actionData, { ts: new Date()}) }
    //                             }, { upsert: true }).catch(() => {});
    //                             // db.mongo.db('maylog').collection('guilds').updateOne({ _id: context.guild!.id }, {
    //                             //     $addToSet: { commandLogs: Object.assign({}, actionData, { ts: new Date() }) }
    //                             // }).catch(() => {});
    //                     }, 10);
    //                 } catch (error) {
    //                     Sentry.captureException(error);
    //                     console.log(error);
    //                 }
    //             }).catch(() => editReply('An error occurred while trying to log the department action. Do I have the `Send Messages` permission?'));
    //         });
    //         collector.on('end', interactions => {
    //             if (interactions.size === 0) editReply('Cancelled.');
    //         })

    //     } catch (error) {
    //         Sentry.captureException(error);
    //         console.log(error);
    //         if (!context.replied) return context.editReply('An error occurred.');
    //     }
    //     return
    // },
});