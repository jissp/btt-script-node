import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from './health-support';
import { EventEmitter } from 'events';

async function main() {
    container.register<string>('ScriptName', { useValue: 'health-support' });
    container.registerInstance<EventEmitter>(EventEmitter, new EventEmitter());

    const script = container.resolve<HealthSupport>(HealthSupport);
    await script.init();
    await script.run();
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
