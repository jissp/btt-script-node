import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from './health-support';

async function main() {
    console.log('start');
    container.register<string>('ScriptName', { useValue: 'health-support' });

    const script = container.resolve<HealthSupport>(HealthSupport);
    await script.init();

    console.log('run');
    await script.run();

    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
