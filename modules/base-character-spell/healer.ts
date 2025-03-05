import { BttKeyCode, BttService } from '../btt-client';
import { BaseMagician } from './base-magician';

export class Healer extends BaseMagician {
    constructor(protected readonly bttService: BttService) {
        super(bttService);
    }

    public async castInvincible() {
        return this.castNoTargeting(BttKeyCode.Number0);
    }
}
