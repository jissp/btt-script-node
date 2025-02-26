import { injectable } from 'tsyringe';
import { BttStorage } from '../storage';

@injectable()
export class Timer {
    private isLock: boolean = false;
    private expiresIn: number = 0;
    private timestamp: number = 0;

    constructor(
        private readonly bttStorage: BttStorage,
        private readonly name: string,
        expiresIn: number,
    ) {
        this.setExpiresIn(expiresIn);
    }

    public async init(callback?: () => Promise<void>) {
        await this.sync();

        if(callback) {
            await callback();
        }
    }

    public setExpiresIn(expiresIn: number) {
        this.expiresIn = expiresIn;
    }

    /**
     * BTT에 저장된 변수와 동기화
     */
    public async sync() {
        this.timestamp = Number(await this.bttStorage.scriptVariable(this.name)) || 0;
    }

    public async set() {
        this.timestamp = Date.now();
        await this.bttStorage.scriptVariable(this.name, this.timestamp.toString());
    }

    public isExpired() {
        if (this.expiresIn === 0) {
            return false;
        }

        return Date.now() - this.timestamp >= this.expiresIn;
    }

    public async acquireLock(callback: () => Promise<void>) {
        if (this.isExpired() && !this.isLock) {
            try {
                this.isLock = true;

                await callback();
            } catch(error) {
                throw error;
            } finally {
                await this.set();
                this.isLock = false;
            }
        }
    }
}
