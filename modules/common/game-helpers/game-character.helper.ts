import * as _ from 'lodash';
import { inject, injectable } from 'tsyringe';
import { BttKeyCode, BttService } from '../../btt-client';
import {
    ChangedObjectHpBar,
    CharacterStatusPartialUpdate,
    CharacterStatusUpdate,
    ClientSelfLook,
    PacketSnifferEvent,
    ParsedPacket,
} from '../../packet-sniffer';
import { GameRect } from '../common.interface';
import { OnEvent } from '../decorators';
import { ocrByClipboard, screenCapture } from '../externals';

export type Coord = { x: number; y: number };

@injectable()
export class GameCharacterHelper {
    private selfObjectId?: string;
    private beforeHealth: number = 0;
    private health: number = 0;
    private mana: number = 0;
    private maxMana: number = 0;

    private beforeHpBarValue: number = 0;
    private hpBarValue: number = 0;

    private detectCharacterHitCount: number = 0; // 피격 카운트

    constructor(@inject(BttService) private readonly bttService: BttService) {}

    public isSetSelfObjectId() {
        return this.selfObjectId !== undefined;
    }

    public setSelfObjectId(objectId: string) {
        this.selfObjectId = objectId;
    }

    public getSelfObjectId() {
        return this.selfObjectId;
    }

    public isSelfObjectId(objectId: string) {
        return this.selfObjectId === objectId;
    }

    public updateHealth(point: number) {
        if (this.health !== point) {
            console.log(`체력 변경 감지 - ${this.beforeHealth} -> ${point}`);
        }
        this.beforeHealth = this.health;
        this.health = point;
    }

    public getHealth() {
        console.log(`현재 체력: ${this.health}`);
        return this.health;
    }

    public updateMana(point: number) {
        if (this.mana !== point) {
            console.log(`마나 변경 감지 - ${this.mana} -> ${point}`);
        }
        this.mana = point;
    }

    public getMana() {
        console.log(`현재 마나: ${this.mana}`);
        return this.mana;
    }

    public updateMaxMana(point: number) {
        this.maxMana = point;
    }

    public getMaxMana() {
        return this.maxMana;
    }

    public updateHpBarValue(value: number) {
        this.beforeHpBarValue = this.hpBarValue;
        this.hpBarValue = value;
    }

    public getHpBarValue() {
        return this.hpBarValue;
    }

    public isHealthBelow(value: number): boolean {
        return this.health <= value;
    }

    public isDead(): boolean {
        return this.isHealthBelow(0);
    }

    public isManaBelow(percent: number): boolean {
        const currentPercent = (this.mana / this.maxMana) * 100;
        return currentPercent < percent;
    }

    public isEmptyMana(): boolean {
        return this.mana < 30;
    }

    /**
     * 피격이 감지되었는지 확인
     */
    public isDetectCharacterHit() {
        return this.detectCharacterHitCount > 0;
    }

    /**
     * 피격이 감지될 때 마다 증가
     */
    public incrementDetectCharacterHitCount() {
        this.detectCharacterHitCount++;
    }

    /**
     * 피격 감지 횟수 초기화
     */
    public resetDetectCharacterHitCount() {
        this.detectCharacterHitCount = 0;
    }

    public async getCurrentCoordinate(): Promise<Coord> {
        await screenCapture({
            rect: await this.bttService.getActiveWindowRect(),
        });

        const coord = this.adjustmentCoord(
            await ocrByClipboard(GameRect.CharacterCoordinate, {
                contrast: 2.5,
            }),
        );

        const [characterX, characterY] = coord.split('\n').map(line => Number(line.replace(' ', '')));

        return {
            x: characterX,
            y: characterY,
        };
    }

    public adjustmentCoord(coord: string) {
        const adjustCoord = coord.trim().replace('g', '9').replace('.', '').replace(' ', '').replace('£', '8');

        return adjustCoord
            .replace('1000', '0001')
            .replace('2000', '0002')
            .replace('3000', '0003')
            .replace('4000', '0004')
            .replace('5000', '0005')
            .replace('6000', '0006')
            .replace('7000', '0007')
            .replace('8000', '0008')
            .replace('9000', '0009');
    }

    public async move({ x, y }: Coord) {
        if (x !== 0) {
            await this.bttService.sendKey(x < 0 ? BttKeyCode.ArrowLeft : BttKeyCode.ArrowRight);
        }

        if (y !== 0) {
            await this.bttService.sendKey(y < 0 ? BttKeyCode.ArrowUp : BttKeyCode.ArrowDown);
        }
    }

    public calcCoordsForToCoord(from: Coord, to: Coord): Coord[] {
        const list: Coord[] = [];

        const moveX = from.x - to.x;
        const moveY = from.y - to.y;

        for (let x = moveX; x !== 0; x < 0 ? x++ : x--) {
            list.push({
                x: x < 0 ? 1 : -1,
                y: 0,
            });
        }

        for (let y = moveY; y !== 0; y < 0 ? y++ : y--) {
            list.push({
                x: 0,
                y: y < 0 ? 1 : -1,
            });
        }

        return _.shuffle(list);
    }

    /**
     * 캐릭터 상태 업데이트 (전체)
     */
    @OnEvent(PacketSnifferEvent.CharacterStatusFull)
    private onCharacterStatusFullUpdate(packet: ParsedPacket<CharacterStatusUpdate>): void {
        const { data } = packet;
        const packetDataKeys = Object.keys(data);

        // HP 업데이트
        if (packetDataKeys.includes('h')) {
            this.updateHealth(Number(data.h));
        }

        // MP 업데이트
        if (packetDataKeys.includes('m')) {
            this.updateMana(Number(data.m));
        }

        // 최대 MP 업데이트
        if (packetDataKeys.includes('mm')) {
            this.updateMaxMana(Number(data.mm));
        }
    }

    /**
     * 캐릭터 상태 부분 업데이트 (HP, MP만)
     */
    @OnEvent(PacketSnifferEvent.CharacterStatusPartial)
    private onCharacterStatusPartialUpdate(packet: ParsedPacket<CharacterStatusPartialUpdate>): void {
        const { data } = packet;
        const packetDataKeys = Object.keys(data);

        // HP 업데이트
        if (packetDataKeys.includes('h')) {
            this.updateHealth(Number(data.h));
        }

        // MP 업데이트
        if (packetDataKeys.includes('m')) {
            this.updateMana(Number(data.m));
        }
    }

    /**
     * HP 바 변경 (피격 감지)
     */
    @OnEvent(PacketSnifferEvent.HpBarChanged)
    private onHpBarChanged(packet: ParsedPacket<ChangedObjectHpBar>): void {
        const { data } = packet;
        const { objectId, hpBarValue, maxHpBarValue } = data;

        // 자신의 HP 바 변경이 아니면 무시
        if (this.getSelfObjectId() !== objectId) {
            return;
        }

        const beforeHpBarValue = this.getHpBarValue();
        this.updateHpBarValue(hpBarValue);

        // HP가 감소했고 최대값이 아니면 피격 감지
        if (hpBarValue <= beforeHpBarValue && hpBarValue !== maxHpBarValue) {
            console.log('캐릭터 피격 감지');
            this.incrementDetectCharacterHitCount();
        } else {
            // 피격 카운트 초기화
            this.resetDetectCharacterHitCount();
        }
    }

    /**
     * 자신의 모습 (objectId 설정)
     */
    @OnEvent(PacketSnifferEvent.SelfLook)
    private onClientSelfLook(packet: ParsedPacket<ClientSelfLook>): void {
        const { data } = packet;
        const { objectId } = data;

        this.setSelfObjectId(objectId);
    }
}
