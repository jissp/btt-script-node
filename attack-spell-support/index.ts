import 'reflect-metadata';
import { container } from 'tsyringe';
import { EventEmitter } from 'events';
import { AttackSpellSupport } from './attack-spell-support';

async function main() {
    container.register<string>('ScriptName', { useValue: 'attack-spell-support' });
    container.registerInstance<EventEmitter>(EventEmitter, new EventEmitter());

    const support = container.resolve<AttackSpellSupport>(AttackSpellSupport);
    await support.init();
    await support.run();
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
