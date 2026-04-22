//the camera entity follows the target entity smoothly from above, using the offset and smoothness defined in the CCamera component

import { Euler, Vector3 } from "three";
import { System } from "../core/system";
import { World } from "../core/world";
import { CCamera } from "../components/CCamera";
import { CPosition } from "../components/CTransform";

export class SCameraFollow extends System {

    constructor() {
        super();
    }

    private getRotatedOffset(cameraComp: CCamera) {
        return new Vector3(0, 0, cameraComp.offset).applyEuler(
            new Euler(
                cameraComp.rotation.x,
                cameraComp.rotation.y,
                cameraComp.rotation.z,
                'YXZ'
            )
        );
    }

    init(world: World): void {
        const cameras = world.query2(CCamera, CPosition)!;

        for (const [_entity, cameraComp, transform] of cameras) {
            const targetTransform = world.getComponent(cameraComp.targetId, CPosition);
            if (!targetTransform) continue;

            cameraComp.cameraObject.rotation.set(
                cameraComp.rotation.x,
                cameraComp.rotation.y,
                cameraComp.rotation.z
            );

            cameraComp.cameraObject.rotation.order = 'YXZ';

            transform.position
                .copy(targetTransform.position)
                .sub(this.getRotatedOffset(cameraComp));

            cameraComp.cameraObject.position.copy(transform.position);
        }
    }

    update(world: World, deltaTime: number): void {
        const cameras = world.query2(CCamera, CPosition)!;

        for (const [_entity, cameraComp, transform] of cameras) {
            const targetTransform = world.getComponent(cameraComp.targetId, CPosition);
            if (!targetTransform) continue;

            const desiredPosition = targetTransform.position
                .clone()
                .sub(this.getRotatedOffset(cameraComp));

            transform.position.lerp(
                desiredPosition,
                Math.min(1, cameraComp.smoothness * deltaTime)
            );

            cameraComp.cameraObject.position.copy(transform.position);
        }
    }
}
