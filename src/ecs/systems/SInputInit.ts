//generates input map, and resets it every frame
import { System } from "../core/system";
import { World } from "../core/world";
import { RInput } from "../resources/RInput";

export class SInputInit extends System {

    constructor() {
        super();
    }

    init(world: World): void {
        const input = world.getResource(RInput)!;

        window.addEventListener("keydown", (e) => {
            if (!input.keysDown.has(e.key)) {
                input.keysPressed.add(e.key);
            }
            input.keysDown.add(e.key);
        });

        window.addEventListener("keyup", (e) => {
            input.keysDown.delete(e.key);
            input.keysReleased.add(e.key);
        });
    }

}