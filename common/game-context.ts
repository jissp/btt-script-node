import { inject, injectable } from 'tsyringe';
import { GameBuffHelper, GameCharacterHelper, GameItemHelper, GameSpellHelper, GameSystemHelper } from './game-helpers';

@injectable()
export class GameContext {
    constructor(
        @inject(GameSystemHelper) public readonly system: GameSystemHelper,
        @inject(GameCharacterHelper) public readonly character: GameCharacterHelper,
        @inject(GameBuffHelper) public readonly buff: GameBuffHelper,
        @inject(GameItemHelper) public readonly item: GameItemHelper,
        @inject(GameSpellHelper) public readonly spell: GameSpellHelper,
    ) {}
}
