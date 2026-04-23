import { CCamera } from "../components/CCamera";
import type { World } from "../core/world";
import { RThree } from "../resources/RThree";

//creates camera entity and attaches a CCamera component to it. The camera will follow the target entity with the given id.
export function FCamera(world: World, targetId: number) {

    const three = world.getResource(RThree)!;
    const camera = three.camera;

    const cameraEntity = world.createEntity();
    world.addComponent(cameraEntity, new CCamera(targetId, camera));
    return cameraEntity;
}