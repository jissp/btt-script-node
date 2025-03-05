import 'reflect-metadata';
import { spawn } from 'child_process';
import Redis from 'ioredis';
import { uSleep } from '../modules/utils';

const variableQueue: string[] = [];

async function main() {
    const client = new Redis({
        host: 'localhost',
        port: 16379,
    });

    async function loop() {
        while (true) {
            if (variableQueue.length > 0) {
                const data = variableQueue.shift();
                if (data) {
                    await client.rpush('packet_data', data);
                }
            }

            await uSleep(25);
        }
    }

    const tcpDump = spawn('sudo', ['sudo', 'tcpdump', '-i', 'en0', '-l', '-x', '-n', 'src port 32800']);

    tcpDump.stdout.on('data', async packet => {
        const data = Buffer.from(packet, 'hex').toString('ascii');
        variableQueue.push(data);
    });

    // Node.js가 종료될 때 tshark도 종료시킴
    process.on('SIGINT', () => {
        console.log('Received SIGINT, terminating tshark...');
        tcpDump.kill(); // tshark 종료
        process.exit(); // Node.js 종료
    });

    process.on('exit', () => {
        console.log('Node.js is exiting...');
        tcpDump.kill(); // Node.js 종료 시 tshark도 종료
    });

    loop();
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
