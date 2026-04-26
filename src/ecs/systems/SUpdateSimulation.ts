//updates simulation state

import { EVENTS, GameEvent } from "../core/event";
import { System } from "../core/system";
import type { World } from "../core/world";
import { REvents } from "../resources/REvents";
import { RInput } from "../resources/RInput";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";

export class SUpdateSimulation extends System {
    update(world: World, _deltaTime: number): void {
        //updates simulation state on key pressed
        const input = world.getResource(RInput)!;

        if (input.keysPressed.has(" ")) {
            SUpdateSimulation.playPause(world);
        }

        if (input.keysPressed.has("d")) {
            SUpdateSimulation.drawModeChange(world, "draw");
        }

        if (input.keysPressed.has("e")) {
            SUpdateSimulation.drawModeChange(world, "erase");
        }
    }

    static playPause(world: World) {
        const simState = world.getResource(RSimulationState)!;
        const events = world.getResource(REvents)!;

        if (simState.state === ESimulationState.Playing) {
            simState.state = ESimulationState.DrawingTrack;
        } else {
            simState.state = ESimulationState.Playing;
        }

        events.emit(
            new GameEvent(EVENTS.SIMULATION_STATE_CHANGED, simState.state)
        );
    }

    static drawModeChange(world: World, newMode: "draw" | "erase") {
        const simState = world.getResource(RSimulationState)!;
        const events = world.getResource(REvents)!;

        if (simState.drawingMode !== newMode) {
            simState.drawingMode = newMode;
            events.emit(
                new GameEvent(EVENTS.DRAW_MODE_CHANGED, simState.drawingMode)
            );
        } 
    }
}
