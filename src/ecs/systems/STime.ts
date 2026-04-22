//updates elapsed and delta time
import { System } from "../core/system";
import { World } from "../core/world";
import { RTime } from "../resources/RTime";

export class STime extends System {

    constructor(){
        super();
    }

    update(world: World, deltaTime: number): void {
        const time = world.getResource(RTime)!;
        time.deltaTime = deltaTime;
        time.elapsedTime += deltaTime;
    }
}