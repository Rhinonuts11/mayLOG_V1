import fetch from 'node-fetch';

/** Return the public IP of this machine. */
export default async (): Promise<string> => {
    return new Promise((resolve, reject) => {
        fetch('https://www.cloudflare.com/cdn-cgi/trace').then(async r => {
            try {
                const text = await r.text();
                const lines = text.split('\n');
                let ip!: string;
                lines.forEach(l => {
                    const [ key, value ] = l.split('=');
                    if (key === 'ip') ip = value;
                });
                resolve(ip);
            } catch (Error) {
                reject(Error);
            }
        }).catch(reject);
    });
}
