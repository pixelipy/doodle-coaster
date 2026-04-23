import type { World } from "./world";

export abstract class Factory {
    id: number = -1;
    init(_world: World) : number {
        return -1;
    }
    static destroy(_world: World, _entityId: number) {}
}