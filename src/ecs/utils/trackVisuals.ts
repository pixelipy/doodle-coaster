import {
    CatmullRomCurve3,
    Euler,
    Group,
    InstancedMesh,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    Quaternion,
    TubeGeometry,
    Vector3,
} from "three";
import { CTrack } from "../components/CTrack";
import type { World } from "../core/world";
import { RAssetManager } from "../resources/RAssetManager";
import { RSettings } from "../resources/RSettings";
import type { RailCenterPieceDefinition, RailProfileDefinition } from "../resources/RTrackProfiles";
import { RTrackProfiles } from "../resources/RTrackProfiles";
import {
    type TrackVisualAnchor,
    buildOffsetRailPoints,
    buildTrackRail,
    measurePolylineLength,
    sampleTrackVisualAnchors,
} from "./trackRail";

import { PipeMaterial } from "../../materials/PipeMaterial";
import { GradientLitMaterial } from "../../materials/GradientLitMaterial";

export function rebuildTrackGeometry(world: World, track: CTrack) {
    const assetManager = world.getResource(RAssetManager)
    const settings = world.getResource(RSettings)!
    const profiles = world.getResource(RTrackProfiles)!

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
        const railPoints = buildOffsetRailPoints(
            visualAnchors,
            railDefinition.lateralOffset,
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
        const material = createRailMaterial(railDefinition.materialKey)
        const mesh = new Mesh(geometry, material)
        railMeshes.push(mesh)
        track.renderRoot?.add(mesh)
    }

    track.setRailMeshes(railMeshes)
    track.anchors = placementAnchors

    const centerPieceInstances = buildCenterPieceInstances(
        assetManager,
        activeProfile,
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

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => material.dispose())
        } else {
            mesh.material.dispose()
        }
    }

    track.railMeshes = []

    if (track.centerPieceInstances) {
        track.centerPieceInstances.parent?.remove(track.centerPieceInstances)
        track.centerPieceInstances.geometry.dispose()

        if (Array.isArray(track.centerPieceInstances.material)) {
            track.centerPieceInstances.material.forEach(material => material.dispose())
        } else {
            track.centerPieceInstances.material.dispose()
        }

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

function createRailMaterial(materialKey: string) {
    const color = getRailColor(materialKey)

    return new PipeMaterial({
        lightDir: new Vector3(0.5, 1, 0.5).normalize(),
        lightColor: color,
        shininess: 16
    })
}

function buildCenterPieceInstances(
    assetManager: RAssetManager | undefined,
    profile: RailProfileDefinition,
    placementAnchors: TrackVisualAnchor[]
) {
    if (!assetManager || !profile.centerPiece?.modelKey) return null

    const centerPieceAnchors = getCenterPiecePlacementAnchors(placementAnchors)
    if (centerPieceAnchors.length === 0 || profile.centerPiece.scale <= 0) {
        return null
    }

    const sourceMesh = getCenterPieceSourceMesh(assetManager, profile.centerPiece.modelKey)
    if (!sourceMesh) return null

    const geometry = sourceMesh.geometry.clone()
    geometry.applyMatrix4(sourceMesh.matrixWorld)

    const material = new GradientLitMaterial({ map: assetManager.getTexture("gradientMap"), lightColor: 0xff0000 })
    console.log(material)

    const instances = new InstancedMesh(geometry, material, centerPieceAnchors.length)
    instances.name = `track-center-pieces:${profile.centerPiece.modelKey}`
    instances.castShadow = sourceMesh.castShadow
    instances.receiveShadow = sourceMesh.receiveShadow

    const dummy = new Object3D()
    const tangentForward = new Vector3(1, 0, 0)
    const yUpToZUp = new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0))
    const tangentRotation = new Quaternion()
    const uniformScale = new Vector3(
        profile.centerPiece.scale,
        profile.centerPiece.scale,
        profile.centerPiece.scale
    )

    centerPieceAnchors.forEach((anchor, index) => {
        tangentRotation.setFromUnitVectors(tangentForward, anchor.tangent)

        dummy.position.copy(anchor.point)
        dummy.quaternion.copy(resolveCenterPieceRotation(
            profile.centerPiece!,
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

function getCenterPieceSourceMesh(assetManager: RAssetManager, modelKey: string) {
    if (!assetManager.hasModel(modelKey)) {
        console.warn(`[trackVisuals] Center piece model is not loaded: ${modelKey}`)
        return null
    }

    const model = assetManager.getModel(modelKey)
    model.updateMatrixWorld(true)

    const meshes: Mesh[] = []
    model.traverse(object => {
        if (object instanceof Mesh) {
            meshes.push(object)
        }
    })

    if (meshes.length !== 1) {
        console.warn(`[trackVisuals] Center piece model must contain exactly one mesh: ${modelKey}`)
        return null
    }

    return meshes[0]
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

function getRailColor(materialKey: string) {
    switch (materialKey) {
        case "red":
            return 0xFF004D
        case "yellow":
            return 0xFFEC27
        case "darkSteel":
            return 0x5d6775
        case "bronze":
            return 0x9a6b3a
        case "steel":
        default:
            return 0xaab3bf
    }
}

function clearGroupChildren(group: Group) {
    while (group.children.length > 0) {
        const child = group.children[group.children.length - 1]
        group.remove(child)
    }
}
