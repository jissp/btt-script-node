import { inject, injectable } from 'tsyringe';
import { LocalStorage } from '../local-storage';
import { BttKeyCode, BttService } from '../btt-client';
import { SearchImageBase64Type } from './interface';

@injectable()
export class BaramUtil {
    /**
     * @param bttService
     * @param localStorage
     */
    constructor(
        @inject(BttService) private readonly bttService: BttService,
        @inject(LocalStorage) private readonly localStorage: LocalStorage,
    ) {}

    async init() {}
}
