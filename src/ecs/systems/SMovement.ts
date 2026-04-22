// adds to the transform, and marks as dirty so the STransformSync will move the mesh

import { System } from "../core/system";
import { World } from "../core/world";
import { CPosition } from "../components/CTransform";
import { CVelocity } from "../components/CVelocity";

export class SMovement extends System {

    constructor(){
        super();
    }

    update(world: World, deltaTime: number): void {
        const entities = world.query2(CPosition, CVelocity);
        for (const [_e, transform, velocity] of entities) {
            transform.position.addScaledVector(velocity.velocity, deltaTime);
        }
    }
}