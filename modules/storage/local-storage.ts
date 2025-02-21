import { injectable } from 'tsyringe';

@injectable()
export class LocalStorage {
    private storages: Record<string, any> = {};

    public variable<T = any>(key: string, value?: T): T {
        if(value === undefined) {
            return this.storages[key];
        }

        return this.storages[key] = value;
    }
}
