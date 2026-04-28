import { System } from "../core/system";
import type { World } from "../core/world";
import { RDebugger } from "../resources/RDebugger";
import { RThree } from "../resources/RThree";

export class SDebugger extends System {
    constructor() {
        super();
    }
    update(world: World, _deltaTime: number): void {
        const threeDScene = world.getResource(RThree)!;
        const debuggerResource = world.getResource(RDebugger);

        if (debuggerResource) {
            debuggerResource.drawCallPanel.update(threeDScene.renderer.info.render.calls, 100);
            debuggerResource.trianglePanel.update(threeDScene.renderer.info.render.triangles, 1000);
        }

        debuggerResource?.stats.update();
    }
}
