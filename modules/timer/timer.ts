import { injectable } from 'tsyringe';
import { BttStorage } from '../storage';

@injectable()
export class Timer {
    private expiresIn: number = 0;
    private timestamp: number = 0;

    constructor(
        private readonly bttStorage: BttStorage,
        private readonly name: string,
        expiresIn: number,
    ) {
        this.setExpiresIn(expiresIn);
    }

    public async init() {
        this.timestamp = Number((await this.bttStorage.scriptVariable(this.name)) ?? 0);
    }

    public setExpiresIn(expiresIn: number) {
        this.expiresIn = expiresIn;
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
}
