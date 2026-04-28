import { Mesh, Object3D, type  Vector3 } from "three";
import type { World } from "../core/world";
import { CPassenger } from "../components/CPassenger";
import { CPosition } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";
import { RAssetManager } from "../resources/RAssetManager";
import { CAnimation } from "../components/CAnimation";
import { GradientLitMaterial } from "../../materials/GradientLitMaterial";
import { LoadPassenger } from "../utils/passengerLoader";

export async function FPassenger(world: World, parent: Object3D, position: Vector3, pose: string): Promise<number> {

    const passengerDefinition = await LoadPassenger('/passengers/passengers.json', 'passenger-classic');

    const model = world.getResource(RAssetManager)!.getModel(passengerDefinition.id);
    model.scale.set(passengerDefinition.scale, passengerDefinition.scale, passengerDefinition.scale);

    model.traverse((child) => {
        if (child instanceof Mesh) {
            child.material = new GradientLitMaterial({
                map: world.getResource(RAssetManager)!.getTexture('gradientMap'),
                color: passengerDefinition.colors[passengerDefinition.activeColorId]
            })
        }
    });

    parent.add(model);
    const entityId = world.createEntity();
    world.addComponent(entityId, new CPassenger());
    world.addComponent(entityId, new CPosition({position: position}));
    world.addComponent(entityId, new CObject3D(model));
    const anim = world.addComponent(entityId, new CAnimation(model));
    anim.animationPlayer.playAnimation(pose, {staticAnim: true, startTime: 1})
    return entityId;
}
