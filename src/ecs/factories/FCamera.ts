//creates a camera that looks at the player, and follows it smoothly from above

import { Vector3 } from "three";
import type { World } from "../core/world";
import { CCamera } from "../components/CCamera";
import { CPosition } from "../components/CTransform";
import { CObject3D } from "../components/CObject3D";
import { RThree } from "../resources/RThree";

export function FCamera(world: World, targetId: number, {smoothness = 5, offset = -60, rotation = new Vector3(-Math.PI/4, Math.PI/6, 0)} : {smoothness?: number, offset?: number, rotation?: Vector3} = {}): number {
    const cameraEntity = world.createEntity();
    const camera = world.getResource(RThree)!.camera;
    camera.rotation.order = 'YXZ'; // Set rotation order to YXZ for proper Euler angles
    world.addComponent(cameraEntity, new CCamera(targetId, camera, {smoothness, offset, rotation}));
    world.addComponent(cameraEntity, new CPosition());
    world.addComponent(cameraEntity, new CObject3D(camera));
    return cameraEntity;
}