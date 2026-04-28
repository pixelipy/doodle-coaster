import {
    CatmullRomCurve3,
    Euler,
    Group,
    InstancedMesh,
    Mesh,
    Object3D,
    Quaternion,
    TubeGeometry,
    Vector3,
} from "three";
import { CTrack } from "../components/CTrack";
import type { World } from "../core/world";
import { RAssetManager } from "../resources/RAssetManager";
import { RSettings } from "../resources/RSettings";
import { RTrackVisualCache } from "../resources/RTrackVisualCache";
import type { RailCenterPieceDefinition } from "../resources/RTrackProfiles";
import { RTrackProfiles } from "../resources/RTrackProfiles";
import {
    type TrackVisualAnchor,
    buildOffsetRailPoints,
    buildTrackRail,
    measurePolylineLength,
    sampleTrackVisualAnchors,
} from "./trackRail";

export function rebuildTrackGeometry(world: World, track: CTrack) {
    const assetManager = world.getResource(RAssetManager)
    const settings = world.getResource(RSettings)!
    const profiles = world.getResource(RTrackProfiles)!
    const trackVisualCache = world.getResource(RTrackVisualCache)!

    if (track.rawPoints.length < 2) {
        track.physicsPoints = []
        track.cumulativeLengths = []
        track.trackLength = 0
        track.sampled = []
        track.anchors = []
        clearTrackVisuals(track)
        return
    }

    const rail = buildTrackRail(
        track.rawPoints,
        settings.track.PHYSICS_POINT_SPACING,
        settings.track.RAIL_SMOOTHING_PASSES
    )
    track.physicsPoints = rail.physicsPoints
    track.cumulativeLengths = rail.cumulativeLengths
    track.trackLength = rail.trackLength
    track.sampled = rail.sampledPoints.map(point => point.clone())

    const activeProfile = profiles.getActiveProfile()
    clearTrackVisuals(track)

    if (!activeProfile || track.trackLength <= 0 || track.physicsPoints.length < 2) {
        track.anchors = []
        return
    }

    trackVisualCache.ensureActiveProfileAssets(
        profiles.version,
        activeProfile,
        assetManager
    )

    const visualAnchors = sampleTrackVisualAnchors(
        track.physicsPoints,
        track.cumulativeLengths,
        track.trackLength,
        activeProfile.visualSampleSpacing
    )
    const placementAnchors = sampleTrackVisualAnchors(
        track.physicsPoints,
        track.cumulativeLengths,
        track.trackLength,
        activeProfile.anchors.spacing
    )

    const railMeshes: Mesh[] = []

    for (const railDefinition of activeProfile.rails) {
        const lateralOffset = track.invertRailProfile
            ? -railDefinition.lateralOffset
            : railDefinition.lateralOffset
        const railPoints = buildOffsetRailPoints(
            visualAnchors,
            lateralOffset,
            railDefinition.verticalOffset
        )
        if (railPoints.length < 2) continue

        const curveLength = measurePolylineLength(railPoints)
        const tubularSegments = Math.max(1, Math.ceil(curveLength / activeProfile.tubeSegmentLength))
        const curve = new CatmullRomCurve3(railPoints, false, "centripetal")
        const geometry = new TubeGeometry(
            curve,
            tubularSegments,
            railDefinition.radius,
            railDefinition.radialSegments,
            false
        )
        const material = trackVisualCache.getRailMaterial(railDefinition.materialKey)
        const mesh = new Mesh(geometry, material)
        railMeshes.push(mesh)
        track.renderRoot?.add(mesh)
    }

    track.setRailMeshes(railMeshes)
    track.anchors = placementAnchors

    const centerPieceInstances = buildCenterPieceInstances(
        trackVisualCache,
        activeProfile.centerPiece,
        placementAnchors
    )

    if (centerPieceInstances) {
        track.centerPieceInstances = centerPieceInstances
        track.renderRoot?.add(centerPieceInstances)
    }
}

export function clearTrackVisuals(track: CTrack) {
    for (const mesh of track.railMeshes) {
        mesh.parent?.remove(mesh)
        mesh.geometry.dispose()
    }

    track.railMeshes = []

    if (track.centerPieceInstances) {
        track.centerPieceInstances.parent?.remove(track.centerPieceInstances)
        track.centerPieceInstances = null
    }
}

export function destroyTrackRender(track: CTrack) {
    clearTrackVisuals(track)

    const renderRoot = track.renderRoot
    if (renderRoot) {
        renderRoot.parent?.remove(renderRoot)
        clearGroupChildren(renderRoot)
        track.renderRoot = null
    }
}

export function rebuildAllTrackVisuals(world: World) {
    for (const [_trackId, track] of world.query1(CTrack)) {
        rebuildTrackGeometry(world, track)
    }
}

function buildCenterPieceInstances(
    trackVisualCache: RTrackVisualCache,
    centerPiece: RailCenterPieceDefinition | undefined,
    placementAnchors: TrackVisualAnchor[]
) {
    if (!centerPiece?.modelKey) return null

    const centerPieceAnchors = getCenterPiecePlacementAnchors(placementAnchors)
    if (centerPieceAnchors.length === 0 || centerPiece.scale <= 0) {
        return null
    }

    const sharedAssets = trackVisualCache.getCenterPieceAssets()
    if (!sharedAssets) return null

    const instances = new InstancedMesh(
        sharedAssets.geometry,
        sharedAssets.material,
        centerPieceAnchors.length
    )
    instances.name = `track-center-pieces:${centerPiece.modelKey}`
    instances.castShadow = sharedAssets.castShadow
    instances.receiveShadow = sharedAssets.receiveShadow

    const dummy = new Object3D()
    const tangentForward = new Vector3(1, 0, 0)
    const yUpToZUp = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))
    const tangentRotation = new Quaternion()
    const uniformScale = new Vector3(
        centerPiece.scale,
        centerPiece.scale,
        centerPiece.scale
    )

    centerPieceAnchors.forEach((anchor, index) => {
        tangentRotation.setFromUnitVectors(tangentForward, anchor.tangent)

        dummy.position.copy(anchor.point)
        dummy.quaternion.copy(resolveCenterPieceRotation(
            centerPiece,
            tangentRotation,
            yUpToZUp
        ))
        dummy.scale.copy(uniformScale)
        dummy.updateMatrix()

        instances.setMatrixAt(index, dummy.matrix)
    })

    instances.instanceMatrix.needsUpdate = true
    instances.computeBoundingBox()
    instances.computeBoundingSphere()

    return instances
}

function getCenterPiecePlacementAnchors(placementAnchors: TrackVisualAnchor[]) {
    if (placementAnchors.length <= 2) return [] as TrackVisualAnchor[]
    return placementAnchors.slice(1, -1)
}

function resolveCenterPieceRotation(
    centerPiece: RailCenterPieceDefinition,
    tangentRotation: Quaternion,
    yUpToZUp: Quaternion
) {
    switch (centerPiece.orientationMode) {
        case "tangent":
        default:
            return tangentRotation.clone().multiply(yUpToZUp)
    }
}

function clearGroupChildren(group: Group) {
    while (group.children.length > 0) {
        const child = group.children[group.children.length - 1]
        group.remove(child)
    }
}
