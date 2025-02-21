import { inject, injectable } from 'tsyringe';
import { BttStorage } from '../storage';
import { Timer } from './index';

@injectable()
export class TimerFactory {
    constructor(@inject(BttStorage) private readonly bttStorage: BttStorage) {}

    public create(name: string, expiresIn: number) {
        return new Timer(this.bttStorage, name, expiresIn);
    }
}
