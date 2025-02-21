import 'reflect-metadata';
import { container } from 'tsyringe';
import { HealthSupport } from './health-support';

async function main() {
    console.log('start');
    const support = container.resolve<HealthSupport>(HealthSupport);
    await support.init();

    console.log('run');
    await support.run();

    console.log('Health Support is done');
}

// 프로그램 시작
main().catch(error => {
    console.error('An error occurred during the migration process:', error);
});
