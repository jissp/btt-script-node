import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from '../../../health-support/health-support';
import { BttService } from '../../btt-client';
import { uSleep } from '../../utils';
import { Coord } from '../character';
import { Wntnftk } from '../../base-character-spell';
import { CharacterFactory } from '../character.factory';

async function main() {
    console.log('wait 3 seconds');
    await uSleep(3000);

    console.log('start');
    container.register<string>('ScriptName', {useValue: 'TEST'});

    const scriptor = container.resolve<HealthSupport>(HealthSupport);
    await scriptor.init();

    const bttService = container.resolve(BttService);

    /* ****************************************************
     *
     **************************************************** */
    const activeWindowRect = await bttService.getActiveWindowRect();

    const characterFactory = container.resolve(CharacterFactory);
    const character = characterFactory.create(Wntnftk);

    let moveCount = 0;
    let coords: Coord[] = [];

    while (true) {
        await scriptor.terminateIfNotRunning();

        if (moveCount % 5 === 0 || coords.length === 0) {
            const characterCoord = await character.getCurrentCoordinate();
            console.log('CharacterCoord', characterCoord);

            coords = character.calcCoordsForToCoord(characterCoord, {
                x: 12,
                y: 8
            });

            if(coords.length === 0) {
                break;
            }
        }

        const moveCoord = coords.shift();
        if(moveCoord) {
            await character.move(moveCoord);
        }

        await uSleep(80);
    }
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});

