//updates simulation state

import { System } from "../core/system";
import type { World } from "../core/world";
import { RInput } from "../resources/RInput";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";

export class SUpdateSimulation extends System{
    update(world: World, deltaTime: number): void {
        //updates simulation state on key pressed
        const input = world.getResource(RInput)!;
        const simState = world.getResource(RSimulationState)!;

        if (input.keysPressed.has(" ")) {
            if (simState.state === ESimulationState.Playing) {
                simState.state = ESimulationState.DrawingTrack;
            } else {
                simState.state = ESimulationState.Playing;
            }
        }
    }
}