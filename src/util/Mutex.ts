// Thanks ChatGPT!
export default class Mutex {
    private locked = false;
    private queue: (() => void)[] = [];
  
    
    /**
     * Acquire the mutex
     * @returns Promise
     */
    public async acquire(): Promise<void> {
        return new Promise(resolve => {
            if (!this.locked) {
                // The mutex is not locked, so acquire it immediately
                this.locked = true;
                resolve();
            } else {
                // The mutex is locked, so add the resolve function to the queue
                this.queue.push(resolve);
            }
        });
    }
      
    /**
     * Release the Mutex
     * @returns void
     */
    public release(): void {
        if (this.queue.length > 0) {
            // There are queued functions waiting to acquire the mutex,
            // so resolve the first function and remove it from the queue
            const _next = this.queue.shift();
            _next?.();
        } else {
            // The mutex is not currently locked, so set the locked flag to false
            this.locked = false;
        }
    }
}