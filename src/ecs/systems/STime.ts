//updates elapsed and delta time
import { System } from "../core/system";
import { World } from "../core/world";
import { RTime } from "../resources/RTime";

const MAX_FRAME_TIME = 0.1;
const MAX_FIXED_STEPS = 5;

export class STime extends System {

    constructor(){
        super();
    }

    update(world: World, deltaTime: number): void {
        const time = world.getResource(RTime)!;
        const clampedDelta = Math.min(deltaTime, MAX_FRAME_TIME);

        time.deltaTime = deltaTime;
        time.elapsedTime += deltaTime;
        time.accumulator += clampedDelta;

        const fixedSteps = Math.min(
            Math.floor(time.accumulator / time.fixedTimestep),
            MAX_FIXED_STEPS
        );

        time.pendingFixedSteps = fixedSteps;
        time.accumulator -= fixedSteps * time.fixedTimestep;
        time.interpolationAlpha = Math.min(1, time.accumulator / time.fixedTimestep);
    }
}