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
    }
}