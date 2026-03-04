export function OnEvent(eventName: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // 메타데이터에 이벤트 핸들러 정보 저장
        if (!Reflect.hasMetadata('events:handlers', target)) {
            Reflect.defineMetadata('events:handlers', [], target);
        }

        const handlers = Reflect.getMetadata('events:handlers', target);
        handlers.push({
            eventName,
            method: propertyKey,
        });
    };
}

export function registerEventHandlers(instance: any, eventEmitter: any): void {
    const handlers = Reflect.getMetadata('events:handlers', Object.getPrototypeOf(instance)) || [];

    for (const handler of handlers) {
        eventEmitter.on(handler.eventName, (data: any) => {
            instance[handler.method](data);
        });
    }
}
