import {
    CatmullRomCurve3,
    Group,
    Mesh,
    MeshStandardMaterial,
    TubeGeometry,
} from "three";
import { CTrack } from "../components/CTrack";
import type { World } from "../core/world";
import { RSettings } from "../resources/RSettings";
import { RTrackProfiles } from "../resources/RTrackProfiles";
import {
    buildOffsetRailPoints,
    buildTrackRail,
    measurePolylineLength,
    sampleTrackVisualAnchors,
} from "./trackRail";

export function rebuildTrackGeometry(world: World, track: CTrack) {
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
    return new MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.2,
    })
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
