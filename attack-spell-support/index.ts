import 'reflect-metadata';
import { container } from 'tsyringe';
import { EventEmitter } from 'events';
import { AttackSpellSupport } from './attack-spell-support';

async function main() {
    console.log('start');
    container.register<string>('ScriptName', { useValue: 'attack-spell-support' });
    container.registerInstance<EventEmitter>(EventEmitter, new EventEmitter());
    const support = container.resolve<AttackSpellSupport>(AttackSpellSupport);
    await support.init();

    console.log('run');
    await support.run();

    console.log('Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
