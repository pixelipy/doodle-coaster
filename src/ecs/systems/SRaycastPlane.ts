import { Plane, Vector3 } from "three";
import { System } from "../core/system";
import type { World } from "../core/world";
import { RRaycast } from "../resources/RRaycast";
import { RInput } from "../resources/RInput";
import { RThree } from "../resources/RThree";

export class SRaycastPlane extends System {

    constructor() {
        super();
    }

    update(world: World, _deltaTime: number): void {
        const raycast = world.getResource(RRaycast)!;
        const input = world.getResource(RInput)!;
        const three = world.getResource(RThree)!;

        const {raycaster, mouseNDC, hitPoint, plane} = raycast;

        //calculate new mouse NDC
        mouseNDC.set(
            (input.mousePosition.x / three.renderer.domElement.clientWidth) * 2 - 1,
            -(input.mousePosition.y / three.renderer.domElement.clientHeight) * 2 + 1
        );

        raycaster.setFromCamera(mouseNDC, three.camera);

        const hit = new Vector3();
        raycaster.ray.intersectPlane(plane, hit);
        hitPoint.copy(hit);

    }
}