//generates input map, and resets it every frame
import { System } from "../core/system";
import { World } from "../core/world";
import { RInput } from "../resources/RInput";

export class SInputReset extends System {

    constructor() {
        super();
    }

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!;
        input.keysPressed.clear();
        input.keysReleased.clear();
        input.lmbPressed = false;
        input.lmbReleased = false;
        input.mmbPressed = false;
        input.mmbReleased = false;
        input.rmbPressed = false;
        input.rmbReleased = false;
        input.zoomDelta = 0;
        input.panDelta.x = 0;
        input.panDelta.y = 0;
        input.mouseDelta.set(0, 0);
    }
}
