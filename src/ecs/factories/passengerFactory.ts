import { Mesh, Object3D, type  Vector3 } from "three";
import type { World } from "../core/world";
import { CPassenger } from "../components/CPassenger";
import { CPosition } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";
import { RAssetManager } from "../resources/RAssetManager";
import { GradientLitMaterial } from "../../materials/GradientLitMaterial";

export function FPassenger(world: World, parent: Object3D, position: Vector3): number {

    const model = world.getResource(RAssetManager)!.getModel('passenger-classic');
    model.scale.set(0.08, 0.08, 0.08);
    model.rotation.y = Math.PI / 2

    model.traverse((child) => {
        if (child instanceof Mesh) {
            child.material = new GradientLitMaterial({
                map: world.getResource(RAssetManager)!.getTexture('gradientMap'),
                color: "#FFFFFF"
            })
        }
    });

    parent.add(model);
    const entityId = world.createEntity();
    world.addComponent(entityId, new CPassenger());
    world.addComponent(entityId, new CPosition({position}));
    world.addComponent(entityId, new CObject3D(model));
    return entityId;
}
