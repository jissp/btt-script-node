import { BaseCharacterSpell } from '../base-character-spell';
import * as _ from 'lodash';
import { container } from 'tsyringe';
import { GameRect, ocrByClipboard, screenCapture } from '../common';
import { BttKeyCode, BttService } from '../btt-client';

export type Coord = { x: number; y: number };

export class Character<Spell = BaseCharacterSpell> {
    private readonly bttService: BttService;

    private selfObjectId?: string;
    private beforeHealth: number = 0;
    private health: number = 0;
    private mana: number = 0;
    private maxMana: number = 0;

    private beforeHpBarValue: number = 0;
    private hpBarValue: number = 0;

    constructor(public readonly spell: Spell) {
        this.bttService = container.resolve(BttService);
    }

    isSetSelfObjectId() {
        return this.selfObjectId !== undefined;
    }

    setSelfObjectId(objectId: string) {
        this.selfObjectId = objectId;
    }

    getSelfObjectId() {
        return this.selfObjectId;
    }

    updateHealth(point: number) {
        if(this.health !== point) {
            console.log(`체력 변경 감지 - ${this.beforeHealth} -> ${point}`);
        }
        this.beforeHealth = this.health;
        this.health = point;
    }

    getHealth() {
        return this.health;
    }

    updateMana(point: number) {
        if(this.mana !== point) {
            console.log(`마나 변경 감지 - ${this.mana} -> ${point}`);
        }
        this.mana = point;
    }

    getMana() {
        return this.mana;
    }

    updateMaxMana(point: number) {
        this.maxMana = point;
    }

    getMaxMana() {
        return this.maxMana;
    }

    updateHpBarValue(value: number) {
        this.beforeHpBarValue = this.hpBarValue;
        this.hpBarValue = value;
    }

    getHpBarValue() {
        return this.hpBarValue;
    }

    async getCurrentCoordinate(): Promise<Coord> {
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

    adjustmentCoord(coord: string) {
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

    async move({ x, y }: Coord) {
        if (x !== 0) {
            await this.bttService.sendKey(x < 0 ? BttKeyCode.ArrowLeft : BttKeyCode.ArrowRight);
        }

        if (y !== 0) {
            await this.bttService.sendKey(y < 0 ? BttKeyCode.ArrowUp : BttKeyCode.ArrowDown);
        }
    }

    calcCoordsForToCoord(from: Coord, to: Coord): Coord[] {
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
}
