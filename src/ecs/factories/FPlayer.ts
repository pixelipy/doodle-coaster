//player factory

import { Vector3, Group } from "three";
import { CPosition, CRotation, CScale } from "../components/CTransform";
import { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { CVelocity } from "../components/CVelocity";
import { CPlayer } from "../components/CPlayer";
import { CGridMovement } from "../components/CMovementMode";
import { CObject3D } from "../components/CObject3D";
import { RAssetManager } from "../resources/RAssetManager";

export async function FPlayer(world: World, {position}: {position?: Vector3} = {}): Promise<number> {
    const assets = world.getResource(RAssetManager)!;
    const model = assets.getModel('player');
    
    const player = world.createEntity();
    const playerGroup = new Group();

    playerGroup.add(model);

    const threeDScene = world.getResource(RThree)!;
    threeDScene.scene.add(playerGroup);

    world.addComponent(player, new CPosition({position}));
    world.addComponent(player, new CRotation())
    world.addComponent(player, new CScale());
    world.addComponent(player, new CVelocity());
    world.addComponent(player, new CGridMovement());
    world.addComponent(player, new CObject3D(playerGroup, model));
    world.addComponent(player, new CPlayer());

    return player;
}