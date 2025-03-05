import { container, inject, injectable } from 'tsyringe';
import { BttKeyCode, BttService } from '../btt-client';
import { BaseMagician } from './base-magician';

@injectable()
export class Wntnftk extends BaseMagician {
    constructor(protected readonly bttService: BttService) {
        super(bttService);
    }

    public async init() {
        await super.init();
    }

    public async castHellfire() {
        return this.cast(BttKeyCode.Number3);
    }
}
