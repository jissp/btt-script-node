import { inject, injectable } from 'tsyringe';
import { BttService } from '../btt-client';
import { BaseCharacterSpell } from '../base-character-spell';
import { Character } from './character';

export type ConstructorType<T> = new (...args: any[]) => T;

@injectable()
export class CharacterFactory {
    constructor(@inject(BttService) private readonly bttService: BttService) {}

    public create<Spell extends BaseCharacterSpell>(spell: ConstructorType<Spell>) {
        return new Character<Spell>(new spell(this.bttService));
    }
}
