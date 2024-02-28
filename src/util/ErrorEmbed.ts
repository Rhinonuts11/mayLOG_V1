import { Colors } from '.';
import { MessageEmbed } from 'discord.js';

export default (text: string): MessageEmbed => {
    return new MessageEmbed()
        .setColor(Colors.getColor('red'))
        .setDescription(`❌ ${text}`);
}