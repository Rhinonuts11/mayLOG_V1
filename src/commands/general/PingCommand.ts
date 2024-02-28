import { Command, CommandType } from 'gcommands';

new Command({
    name: 'ping',
    description: 'Return the ping of the bot.',
    type: [ CommandType.SLASH ],
    dmPermission: false,

    run(context) {
        context.reply({ ephemeral: true, content: `:ping_pong: Pong! Latency to Discord: ${context.client.ws.ping}ms` });
    },
});