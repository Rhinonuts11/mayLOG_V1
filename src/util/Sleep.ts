export default async (sleepMs: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, sleepMs);
    })
}