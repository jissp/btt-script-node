import 'reflect-metadata';
import Redis from 'ioredis';
import * as net from 'node:net';
import { uSleep } from '../modules/utils';

const variableQueue: string[] = [];

async function main() {
    async function loop() {
        while (true) {
            if (variableQueue.length > 0) {
                const data = variableQueue.shift();
                if (data) {
                    await redisClient.rpush('packet_data', data);
                }
            }

            await uSleep(25);
        }
    }

    const SOCKET_PATH = '/tmp/tcp_dump.sock';
    const redisClient = new Redis({
        host: 'localhost',
        port: 16379,
    });
    // Unix 소켓에 연결
    const unixClient = net.createConnection(SOCKET_PATH, () => {});

    unixClient.on('data', buffer => {
        console.log(buffer.toString('ascii'));
        variableQueue.push(buffer.toString('ascii'));
    });

    loop();
}

// 프로그램 시작
main().catch(error => {
    console.error('An error has been detected, so the process will be terminated.', error);
});
