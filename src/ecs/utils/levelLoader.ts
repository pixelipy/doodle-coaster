import { Vector3 } from "three";
import { CPosition, CRotation } from "../components/CTransform";
import type { World } from "../core/world";
import { FObstacle } from "../factories/obstacleFactory";
import { FStation } from "../factories/stationFactory";
import { FCart4Passengers } from "../factories/cart/cart4passengers";
import {
    type LevelDefinition,
    type LevelStationDefinition,
    type LevelVectorDefinition,
    RLevel,
} from "../resources/RLevel";

export async function loadLevelDefinition(path: string): Promise<LevelDefinition> {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load level definition from ${path}`);
    }

    return await response.json() as LevelDefinition;
}

export function spawnLevel(world: World, definition: LevelDefinition): { cartId: number } {
    const level = world.getResource(RLevel)!;
    level.reset(definition);

    spawnStations(world, definition);
    spawnObstacles(world, definition);

    const spawnStation = definition.stations.find(station => station.id === definition.cartSpawnStationId);
    if (!spawnStation) {
        throw new Error(`Cart spawn station "${definition.cartSpawnStationId}" was not found in level "${definition.id}"`);
    }

    const spawnPosition = vectorFromDefinition(spawnStation.position);
    const spawnDirection = vectorFromDefinition(spawnStation.direction);
    const rotationZ = Math.atan2(spawnDirection.y, spawnDirection.x);
    const cartId = FCart4Passengers(world, { position: spawnPosition, rotationZ });
    const cartPosition = world.getComponent(cartId, CPosition);
    const cartRotation = world.getComponent(cartId, CRotation);

    if (cartPosition) {
        cartPosition.position.copy(spawnPosition);
        cartPosition.previousPosition.copy(spawnPosition);
    }

    if (cartRotation) {
        cartRotation.rotation.set(0, 0, rotationZ);
        cartRotation.previousRotation.copy(cartRotation.rotation);
    }

    level.cartId = cartId;
    return { cartId };
}

export function spawnStations(world: World, definition: LevelDefinition) {
    const level = world.getResource(RLevel)!;

    for (const stationDefinition of definition.stations) {
        const { stationEntityId, stubTrackId } = FStation(world, stationDefinition);
        level.stationEntities.set(stationDefinition.id, stationEntityId);
        level.stationStubTracks.set(stationDefinition.id, stubTrackId);
    }
}

export function spawnObstacles(world: World, definition: LevelDefinition) {
    const level = world.getResource(RLevel)!;

    for (const obstacleDefinition of definition.obstacles) {
        const obstacleEntityId = FObstacle(world, obstacleDefinition);
        level.obstacleEntities.set(obstacleDefinition.id, obstacleEntityId);
    }
}

export function vectorFromDefinition(definition: LevelVectorDefinition) {
    return new Vector3(definition.x, definition.y, definition.z ?? 0);
}

export function getStationDefinition(
    definition: LevelDefinition,
    stationId: string
): LevelStationDefinition | undefined {
    return definition.stations.find(station => station.id === stationId);
}
