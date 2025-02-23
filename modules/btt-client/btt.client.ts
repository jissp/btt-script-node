import { injectable } from 'tsyringe';
import axios, { Axios } from 'axios';
import { buildUrl, IQueryParams } from 'build-url-ts';
import { ScriptType } from './btt.interface';

@injectable()
export class BttClient {
    private axios: Axios;

    constructor(private readonly secret: string) {
        this.axios = axios.create({
            baseURL: 'http://127.0.0.1:53257',
        });
    }

    public async setStringVariable(variableName: string, to: string): Promise<string> {
        return this.call<string>(ScriptType.SetStringVariable, {
            variableName,
            to,
        });
    }

    public async getStringVariable(variableName: string): Promise<string | 'undefined'> {
        return this.call<string | 'undefined'>(ScriptType.GetStringVariable, {
            variableName,
        });
    }

    public async setNumberVariable(variableName: string, to: number): Promise<number> {
        return this.call<number>(ScriptType.SetNumberVariable, {
            variableName,
            to,
        });
    }

    public async getNumberVariable(variableName: string): Promise<number> {
        return this.call<number>(ScriptType.GetNumberVariable, {
            variableName,
        });
    }

    public async triggerAction<T = any>(json: Record<string, any>): Promise<T> {
        return this.call<T>(ScriptType.TriggerAction, {
            json: JSON.stringify(json),
        });
    }

    public async executeAssignedActionsForTrigger<T = any>(uuid: string): Promise<T> {
        return this.call<T>(ScriptType.ExecuteAssignedActionsForTrigger, {
            uuid,
        });
    }

    private async call<T = any>(method: ScriptType, params: IQueryParams): Promise<T> {
        const url = buildUrl({
            queryParams: {
                ...params,
            },
        });

        const response = await this.axios.request({
            url: `${method}/${url}`,
        });

        return response.data;
    }
}
