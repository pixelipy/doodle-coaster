import { System } from "../core/system";
import { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { RWindow } from "../resources/RWindow";

export class SRender extends System {
    constructor() {
        super();
    }

    init(world: World): void {
        const res = world.getResource(RWindow)!;

        function onResize() {
            res.width = window.innerWidth;
            res.height = window.innerHeight;
            res.resized = true;
        }

        window.addEventListener("resize", onResize);
        onResize();
    }

    update(world: World, _deltaTime: number): void {
        const threeDScene = world.getResource(RThree)!;
        const window = world.getResource(RWindow)!;

        if (window.resized) {
            threeDScene.camera.aspect = window.width / window.height;
            threeDScene.camera.updateProjectionMatrix();
            threeDScene.renderer.setSize(window.width, window.height);
            window.resized = false;
        }

        threeDScene.renderer.render(threeDScene.scene, threeDScene.camera);
    }

}