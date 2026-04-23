//moves meshes to their transform position rotation and scale

import { System } from "../core/system";
import { World } from "../core/world";
import { CPosition, CRotation, CScale } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";
import { RTime } from "../resources/RTime";

export class STransformSync extends System {

    constructor(){
        super();
    }

    //not all entities will have all 3 transform components, so we need to query them separately and only update the ones that have the relevant component
    update(world: World, _deltaTime: number): void {
        const time = world.getResource(RTime)!;
        const alpha = time.interpolationAlpha;

        const positionEntities = world.query2(CObject3D, CPosition);
        for (const [_e, object3DComp, position] of positionEntities) {
            object3DComp.object3D.position.lerpVectors(position.previousPosition, position.position, alpha);
        }

        const rotationEntities = world.query2(CObject3D, CRotation);
        for (const [_e, object3DComp, rotation] of rotationEntities) {
            object3DComp.object3D.rotation.set(
                lerpAngle(rotation.previousRotation.x, rotation.rotation.x, alpha),
                lerpAngle(rotation.previousRotation.y, rotation.rotation.y, alpha),
                lerpAngle(rotation.previousRotation.z, rotation.rotation.z, alpha)
            );
        }

        const scaleEntities = world.query2(CObject3D, CScale);
        for (const [_e, object3DComp, scale] of scaleEntities) {
            object3DComp.object3D.scale.copy(scale.scale);
        }
    }
}

function lerpAngle(a: number, b: number, t: number): number {
    let delta = b - a;

    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    return a + delta * t;
}