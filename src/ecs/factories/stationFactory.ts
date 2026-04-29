import {
    BoxGeometry,
    Group,
    Mesh,
    MeshBasicMaterial,
    Vector3,
} from "three";
import { CObject3D } from "../components/CObject3D";
import { CStation } from "../components/CStation";
import { CTrack } from "../components/cartandtrack/CTrack";
import { CPosition, CRotation } from "../components/CTransform";
import type { World } from "../core/world";
import { FTrack } from "./trackFactory";
import { RThree } from "../resources/RThree";
import type { LevelStationDefinition } from "../resources/RLevel";
import { rebuildTrackGeometry } from "../utils/cartandtrack/trackVisuals";

export function FStation(
    world: World,
    definition: LevelStationDefinition
): { stationEntityId: number, stubTrackId: number } {
    const three = world.getResource(RThree)!;
    const stubTrackId = new FTrack().init(world);
    const stubTrack = world.getComponent(stubTrackId, CTrack)!;

    stubTrack.trackRole = "stationStub";
    stubTrack.stationId = definition.id;
    stubTrack.invertRailProfile = definition.kind === "goal";
    stubTrack.immutable = true;
    stubTrack.setRawPoints(
        createStationStubPoints(definition.position, definition.direction, definition.stubLength),
        ["protected", "protected"]
    );
    rebuildTrackGeometry(world, stubTrack);

    const group = new Group();
    const visualGroup = new Group();
    group.add(visualGroup);

    const indicator = new Mesh(
        new BoxGeometry(definition.radius * 0.8, definition.radius * 0.18, 0.08),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    );
    indicator.position.set(definition.radius * 0.35, 0, 0.03);
    visualGroup.add(indicator);

    if (definition.kind === "goal") {
        // Keep goal station art upright without changing the stub track direction used by gameplay.
        visualGroup.rotation.z = Math.PI;
    }

    three.scene.add(group);

    const stationEntityId = world.createEntity();
    const stationPosition = vectorFromDefinition(definition.position);
    const stationDirection = vectorFromDefinition(definition.direction).normalize();
    const angle = Math.atan2(stationDirection.y, stationDirection.x);

    world.addComponent(stationEntityId, new CStation(
        definition.id,
        definition.kind,
        definition.boostSpeed,
        definition.radius,
        stubTrackId
    ));
    world.addComponent(stationEntityId, new CPosition({ position: stationPosition }));
    world.addComponent(stationEntityId, new CRotation({ rotation: new Vector3(0, 0, angle) }));
    world.addComponent(stationEntityId, new CObject3D(group));

    return { stationEntityId, stubTrackId };
}

export function createStationStubPoints(
    positionDefinition: LevelStationDefinition["position"],
    directionDefinition: LevelStationDefinition["direction"],
    stubLength: number
): Vector3[] {
    const start = vectorFromDefinition(positionDefinition);
    const direction = vectorFromDefinition(directionDefinition);
    direction.z = 0;

    if (direction.lengthSq() === 0) {
        direction.set(1, 0, 0);
    } else {
        direction.normalize();
    }

    const end = start.clone().addScaledVector(direction, stubLength);
    return [start, end];
}

function vectorFromDefinition(definition: { x: number, y: number, z?: number }) {
    return new Vector3(definition.x, definition.y, definition.z ?? 0);
}
