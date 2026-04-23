// adds to the transform, and marks as dirty so the STransformSync will move the mesh

import { System } from "../core/system";
import { CCart } from "../components/CCart";
import { World } from "../core/world";
import { CPosition } from "../components/CTransform";
import { CVelocity } from "../components/CVelocity";
import { CPassenger } from "../components/CPassenger";

export class SMovement extends System {

    constructor(){
        super();
    }

    update(world: World, deltaTime: number): void {
        const entities = world.query2(CPosition, CVelocity);
        for (const [entity, transform, velocity] of entities) {
            if (world.hasComponent(entity, CCart) || world.hasComponent(entity, CPassenger)) continue;
            transform.position.addScaledVector(velocity.velocity, deltaTime);
        }
    }
}