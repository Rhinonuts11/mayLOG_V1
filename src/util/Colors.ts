function rgb(r: number, g: number, b: number) {
    return (r << 16) + (g << 8) + b
}

const colors = {
    
    mayLOG: rgb(37, 183, 211),
    red: rgb(237, 66, 69),
    pink: rgb(235, 69, 158),
    maroon: rgb(128, 0, 0),
    coral: rgb(240, 128, 128),
    blue: rgb(42, 114, 199),
    dodgerBlue: rgb(30, 144, 255),
    lightBlue: rgb(70, 130, 180),
    steelBlue: rgb(54, 82, 109),
    deepOrange: rgb(194, 125, 14),
    green: rgb(87, 242, 135),
    limeGreen: rgb(46, 204, 113),
    darkAqua: rgb(0, 139, 139),
    lightGreen: rgb(26, 188, 156),
    darkGreen: rgb(17, 128, 106),
    black: rgb(1, 1, 1),
    white: rgb(255,255,255),
    orange: rgb(230, 126, 34),
    gold: rgb(249, 166, 2),
    metallicGold: rgb(212, 175, 55),
    darkGrey: rgb(50, 50, 50),
    grey: rgb(128, 128, 128),
    lightBlack: rgb(34, 34, 34),
    yellow: rgb(254, 231, 92),
    discordSuccess: rgb(67, 173, 127)
}

function getColorList(): string[] {
    return Object.keys(colors);
}

function getColor(color: keyof typeof colors): number {
    return colors[color];
}

function determineColor(color: string) {
    if (color.startsWith('#')) return color;
    return getColor(color as keyof typeof colors) || '#ff0000'
}

export default { determineColor, getColor, getColorList}