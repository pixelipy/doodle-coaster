import { BoxGeometry, Mesh, MeshNormalMaterial, type  Vector3 } from "three";
import type { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { CPassenger } from "../components/CPassenger";
import { CPosition, CRotation } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";
import { CVelocity } from "../components/CVelocity";

export function FPassenger(world: World, position: Vector3): number {
    const three = world.getResource(RThree)!;
    const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshNormalMaterial());


    three.scene.add(mesh);
    const entityId = world.createEntity();
    world.addComponent(entityId, new CPassenger(null));
    world.addComponent(entityId, new CPosition({position}));
    world.addComponent(entityId, new CVelocity());
    world.addComponent(entityId, new CRotation());
    world.addComponent(entityId, new CObject3D(mesh));
    return entityId;


}