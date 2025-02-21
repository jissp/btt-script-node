import { inject, injectable } from 'tsyringe';
import { BttClient } from '../btt-client';

@injectable()
export class BttStorage {
    constructor(
        @inject('ScriptName') private readonly scriptName: string,
        @inject(BttClient) private readonly bttClient: BttClient,
    ) {}

    public async numberVariable(name: string, value?: number) {
        if (value === undefined) {
            return this.bttClient.getNumberVariable(name);
        }

        return this.bttClient.setNumberVariable(name, value);
    }

    public async stringVariable(name: string, value?: string) {
        if (value === undefined) {
            return this.bttClient.getStringVariable(name);
        }

        return this.bttClient.setStringVariable(name, value);
    }

    public async scriptVariable(name: string, value?: string) {
        if (value === undefined) {
            return this.bttClient.getStringVariable(`${this.scriptName}-${name}`);
        }

        return this.bttClient.setStringVariable(`${this.scriptName}-${name}`, value);
    }

    public async scriptNumberVariable(name: string, value?: number) {
        if (value === undefined) {
            return this.bttClient.getNumberVariable(`${this.scriptName}-${name}`);
        }

        return this.bttClient.setNumberVariable(`${this.scriptName}-${name}`, value);
    }
}
