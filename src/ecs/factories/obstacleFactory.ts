import {
    CircleGeometry,
    Group,
    Mesh,
    MeshBasicMaterial,
    RingGeometry,
    Vector3,
} from "three";
import { CObstacle } from "../components/CObstacle";
import { CObject3D } from "../components/CObject3D";
import { CPosition } from "../components/CTransform";
import type { World } from "../core/world";
import type { LevelObstacleDefinition } from "../resources/RLevel";
import { RThree } from "../resources/RThree";

export function FObstacle(world: World, definition: LevelObstacleDefinition): number {
    const three = world.getResource(RThree)!;
    const group = new Group();
    const fill = new Mesh(
        new CircleGeometry(definition.radius, 32),
        new MeshBasicMaterial({
            color: 0xc0392b,
            transparent: true,
            opacity: 0.28,
        })
    );
    fill.position.z = 0.01;
    group.add(fill);

    const ring = new Mesh(
        new RingGeometry(definition.radius * 0.84, definition.radius, 32),
        new MeshBasicMaterial({ color: 0xe74c3c })
    );
    ring.position.z = 0.02;
    group.add(ring);
    three.scene.add(group);

    const position = new Vector3(
        definition.position.x,
        definition.position.y,
        definition.position.z ?? 0
    );

    const entityId = world.createEntity();
    world.addComponent(entityId, new CObstacle(definition.id, definition.radius));
    world.addComponent(entityId, new CPosition({ position }));
    world.addComponent(entityId, new CObject3D(group));

    return entityId;
}
