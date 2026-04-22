import type { World } from "./world";

export abstract class System{
    init?(world: World): void;
    update?(world: World, deltaTime: number): void;
}