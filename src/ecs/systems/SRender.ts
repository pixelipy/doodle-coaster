import { CHide } from "../components/CHide";
import { CObject3D } from "../components/CObject3D";
import { CObstacle } from "../components/CObstacle";
import { EVENTS } from "../core/event";
import { System } from "../core/system";
import { World } from "../core/world";
import { REvents } from "../resources/REvents";
import { ESimulationState } from "../resources/RSimulationState";
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
        const events = world.getResource(REvents)!;

        if (window.resized) {
            threeDScene.camera.aspect = window.width / window.height;
            threeDScene.camera.updateProjectionMatrix();
            threeDScene.renderer.setSize(window.width, window.height);
            window.resized = false;
        }

        //consume events that might affect rendering, like hiding objects, changing materials, etc.
        for (const event of events.current) {
            if (event.type == EVENTS.SIMULATION_STATE_CHANGED) {
                if (event.data == ESimulationState.Playing) {
                    for (const [e] of world.query1(CObstacle)) {
                        world.addComponent(e, new CHide());
                    }
                }
                else {
                    for (const [e] of world.query2(CObstacle, CHide)) {
                        world.removeComponent(e, CHide);
                    }
                }
            }
        }

        //hide objects before rendering. Later can be used for culling and optimization.
        for (const [e, obj] of world.query1(CObject3D)) {
            const hidden = world.hasComponent(e, CHide);
            obj.object3D.visible = !hidden;
        }

        threeDScene.renderer.render(threeDScene.scene, threeDScene.camera);
    }

}