let regex = (string: string, regex: RegExp) => {
    let m;
    let matches: any[] = [];
    let i = 0;
    while((m = regex.exec(string)) !== null) {
        if(m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        m.forEach((match, group) => {
            if(match == '' || match == undefined) return;
            if(group == 1) {
                matches.push(match);
            }
        });
        i++;
    }
    let max = 0;
    for(let i = 0; i < matches.length; i++) {
        let val = matches[i].replace(/[^\d]/gm, '');
        max += parseInt(val);
    }
    return max;
}

/**
 * Parse a duration string into milliseconds.
 * @param string The string (e.g. 1d2h1s, 30m, 1w, etc)
 * @param limit The maximum amount of milliseconds **that can be returned**. Pass `0` for no limit, otherwise defaults to `31557600000` (a year).
 * @returns A number (milliseconds) or false (indicating an error or the number exceeds the limit)
 */
const durationStringToMilliseconds = (string: string, limit: number = 31557600000): number | false => {
    let seconds = regex(string, /(\d+s)?/gm);
    let minutes = regex(string, /(?:(\d+m)(?=\d|$))?/gm);
    let hours = regex(string, /(\d+h)?/gm);
    let days = regex(string, /(\d+d)?/gm);
    let weeks = regex(string, /(\d+w)?/gm);
    let months = regex(string, /(\d+mo)?/gm);
    let years = regex(string, /(\d+y)?/gm);

    let ret: any = {};
    if(seconds > 0) ret["seconds"] = seconds;
    if(minutes > 0) ret["minutes"] = minutes;
    if(hours > 0) ret["hours"] = hours;
    if(days > 0) ret["days"] = days;
    if(weeks > 0) ret["weeks"] = weeks;
    if(months > 0) ret["months"] = months;
    if(years > 0) ret["years"] = years;    

    const timing: any = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000,
        days: 86400000,
        weeks: 604800000,
        months: 2629800000,
        years: 31557600000
    }
    let currentTime = 0;
    for(let key in ret) {
        if(ret[key] && ret[key] > 0) {
            currentTime += ret[key] * timing[key];
        }
    }

    if (limit) {
        if(currentTime > limit) {
            return false;
        }
    }
    return currentTime;
}

export default durationStringToMilliseconds;