import { inject, injectable } from 'tsyringe';
import { LocalStorage } from '../../storage';
import { ocrByClipboard, screenCapture } from '../externals';
import { GameRect } from '../common.interface';
import { Timer, TimerFactory } from '../../timer';
import { ScriptHelper } from '../script.helper';
import { Nullable } from '../types';

@injectable()
export class GameBuffHelper {
    private buffCheckerTimer: Timer;

    constructor(
        @inject(ScriptHelper) private readonly scriptHelper: ScriptHelper,
        @inject(LocalStorage) private readonly localStorage: LocalStorage,
        @inject(TimerFactory) timerFactory: TimerFactory,
    ) {
        this.buffCheckerTimer = timerFactory.create('check-buff', 200);
    }

    public extractBuffNameAndSeconds(str: string): [string, number] | [] {
        const matches = str.match(/([가-힣]+).?([0-9]+)초/);
        if (!matches) {
            return [];
        }

        return [matches[1], Number(matches[2])];
    }

    /**
     * 버프 목록을 업데이트합니다.
     */
    public updateBuffList() {
        return this.buffCheckerTimer.acquireLock(async () => {
            await screenCapture({
                rect: this.scriptHelper.getActiveWindowRect(),
            });
            const buffFullText = await ocrByClipboard(GameRect.BuffBox);
            const buffs = buffFullText.trim().split('\n').map(this.extractBuffNameAndSeconds);

            this.storeBuffs(buffs);
        });
    }

    /**
     * 버프 목록을 로컬 스토리지에 저장합니다.
     * @param buffs 추출된 버프 배열 ([이름, 남은시간] 또는 [])
     */
    public storeBuffs(buffs: ([string, number] | [])[]): void {
        const validBuffs = buffs.filter((buff): buff is [string, number] => buff.length > 0);
        this.localStorage.variable('buff-map', Object.fromEntries(validBuffs));
        this.localStorage.variable('buffs', validBuffs);
    }

    /**
     * 버프 목록에서 버프의 남은 시간을 가져옵니다.
     */
    public getBuffTime(buffName: string): Nullable<number> {
        const buffMap = this.localStorage.variable('buff-map') as Record<string, number>;

        return buffMap[buffName];
    }
}
