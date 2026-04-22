//moves meshes to their transform position rotation and scale

import { System } from "../core/system";
import { World } from "../core/world";
import { CPosition, CRotation, CScale } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";

export class STransformSync extends System {

    constructor(){
        super();
    }

    //not all entities will have all 3 transform components, so we need to query them separately and only update the ones that have the relevant component
    update(world: World, _deltaTime: number): void {
        const positionEntities = world.query2(CObject3D, CPosition);
        for (const [_e, object3DComp, position] of positionEntities) {
            object3DComp.object3D.position.copy(position.position);
        }

        const rotationEntities = world.query2(CObject3D, CRotation);
        for (const [_e, object3DComp, rotation] of rotationEntities) {
            object3DComp.object3D.rotation.set(rotation.rotation.x, rotation.rotation.y, rotation.rotation.z);
        }

        const scaleEntities = world.query2(CObject3D, CScale);
        for (const [_e, object3DComp, scale] of scaleEntities) {
            object3DComp.object3D.scale.copy(scale.scale);
        }
    }
}