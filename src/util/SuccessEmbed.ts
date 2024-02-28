import { Colors } from '.';
import { MessageEmbed } from 'discord.js';
import Constants from '../Constants';

export default (text: string): MessageEmbed => {
    return new MessageEmbed()
        .setColor(Colors.getColor('discordSuccess'))
        .setDescription(`${Constants.emojis.authorized} ${text}`);
}