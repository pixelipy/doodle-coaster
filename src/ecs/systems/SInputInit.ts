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

        window.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                if (!input.lmbDown) {
                    input.lmbPressed = true;
                }
                input.lmbDown = true;
            } else if (e.button === 1) {
                if (!input.mmbDown) {
                    input.mmbPressed = true;
                }
                input.mmbDown = true;
            } else if (e.button === 2) {
                if (!input.rmbDown) {
                    input.rmbPressed = true;
                }
                input.rmbDown = true;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                input.lmbDown = false;
                input.lmbReleased = true;
            } else if (e.button === 1) {
                input.mmbDown = false;
                input.mmbReleased = true;
            } else if (e.button === 2) {
                input.rmbDown = false;
                input.rmbReleased = true;
            }
        });

        window.addEventListener("mousemove", (e) => {
            input.mouseDelta.set(e.movementX, e.movementY);
            input.mousePosition.set(e.clientX, e.clientY);
        });

    }

}