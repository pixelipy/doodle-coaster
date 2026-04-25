import { BufferGeometry, Vector3 } from "three"
import { CObstacle } from "../components/CObstacle"
import { System } from "../core/system"
import { RInput } from "../resources/RInput"
import { CTrack } from "../components/CTrack"
import { RRaycast } from "../resources/RRaycast"
import { RTrackManager } from "../resources/RTrackManager"
import { World } from "../core/world"
import { FTrack } from "../factories/trackFactory"
import { ESimulationState, RSimulationState } from "../resources/RSimulationState"
import { buildTrackRail } from "../utils/trackRail"
import { RSettings } from "../resources/RSettings"
import type { TrackPointLock } from "../components/CTrack"
import { CPosition } from "../components/CTransform"

let MIN_DIST = 0.3
let SNAP_DIST = 0.2
let ERASE_RADIUS = 0.45
let ALLOW_SELF_JOINS = false
let PHYSICS_POINT_SPACING = 0.05
let RAIL_SMOOTHING_PASSES = 2

type RawPointRun = {
    points: Vector3[]
    locks: TrackPointLock[]
}

export class SDrawTrack extends System {

    init(world: World): void {
        const settings = world.getResource(RSettings)!.track

        MIN_DIST = settings.SAMPLE_DISTANCE
        SNAP_DIST = settings.SNAP_TO_POINT_DISTANCE
        ERASE_RADIUS = settings.ERASER_RADIUS
        ALLOW_SELF_JOINS = settings.ALLOW_SELF_JOINS
        PHYSICS_POINT_SPACING = settings.PHYSICS_POINT_SPACING
        RAIL_SMOOTHING_PASSES = settings.RAIL_SMOOTHING_PASSES
    }

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!
        const drawing = world.getResource(RTrackManager)!
        const raycast = world.getResource(RRaycast)!
        const simulationState = world.getResource(RSimulationState)!

        if (simulationState.state !== ESimulationState.DrawingTrack) return

        if (input.keysPressed.has("e")) {
            simulationState.drawingMode = simulationState.drawingMode === "erase" ? "draw" : "erase"
        }

        if (simulationState.drawingMode === "erase") {
            if (input.lmbDown) {
                const mouse = getFlatRaycastPoint(raycast)
                const hit = findClosestTrack(world, mouse, ERASE_RADIUS)

                if (hit !== null) {
                    eraseTrackAtPoint(world, hit, mouse, ERASE_RADIUS)
                }
            }

            return
        }

        if (input.lmbPressed) {
            beginTrackStroke(world, drawing, getFlatRaycastPoint(raycast))
        }

        if (input.lmbReleased && drawing.currentTrackId !== null) {
            finishTrackStroke(world, drawing, getFlatRaycastPoint(raycast))
            return
        }

        if (drawing.currentTrackId === null) return

        const track = world.getComponent(drawing.currentTrackId, CTrack)
        if (!track) return
        if (track.immutable) return

        let dirty = false

        if (input.lmbDown) {
            const point = getFlatRaycastPoint(raycast)

            const anchor = drawing.extendFromStart
                ? track.rawPoints[0]
                : track.rawPoints[track.rawPoints.length - 1]

            if (!anchor) {
                if (!canAppendPoint(world, point)) return

                if (drawing.extendFromStart) {
                    track.unshiftRawPoint(point)
                } else {
                    track.pushRawPoint(point)
                }

                dirty = true
            } else if (appendInterpolatedRawPoints(world, track, drawing.extendFromStart, point, MIN_DIST)) {
                dirty = true
            }
        }

        if (dirty) {
            rebuildTrackGeometry(track)
        }
    }
}

function getFlatRaycastPoint(raycast: RRaycast) {
    const point = raycast.hitPoint.clone()
    point.z = 0
    return point
}

function beginTrackStroke(world: World, drawing: RTrackManager, mouse: Vector3) {
    const snap = findClosestEndpoint(world, mouse, SNAP_DIST)

    if (snap) {
        const snapTrack = world.getComponent(snap.trackId, CTrack)
        const snapPoint = snapTrack
            ? getTrackEndpointPoint(snapTrack, snap.endpoint)
            : null

        if (!snapTrack || !snapPoint) return

        if (snapTrack.immutable || snapTrack.isEndpointProtected(snap.endpoint)) {
            const entity = new FTrack().init(world)
            const track = world.getComponent(entity, CTrack)!
            track.pushRawPoint(snapPoint)

            drawing.currentTrackId = entity
            drawing.extendFromStart = false
            return
        }

        drawing.currentTrackId = snap.trackId
        drawing.extendFromStart = snap.endpoint === "start"
        return
    }

    if (findBlockingObstacle(world, mouse)) {
        return
    }

    const entity = new FTrack().init(world)
    const track = world.getComponent(entity, CTrack)!

    track.pushRawPoint(mouse)
    drawing.currentTrackId = entity
    drawing.extendFromStart = false
}

function finishTrackStroke(world: World, drawing: RTrackManager, mouse: Vector3) {
    const currentTrackId = drawing.currentTrackId
    if (currentTrackId === null) return

    tryJoinTrackOnRelease(world, currentTrackId, drawing.extendFromStart, mouse)

    const track = world.getComponent(currentTrackId, CTrack)
    if (track && track.rawPoints.length < 2) {
        FTrack.destroy(world, currentTrackId)
        world.destroyEntity(currentTrackId)
    }

    drawing.currentTrackId = null
    drawing.extendFromStart = false
}

function appendInterpolatedRawPoints(
    world: World,
    track: CTrack,
    extendFromStart: boolean,
    targetPoint: Vector3,
    spacing: number
): boolean {
    const anchor = extendFromStart
        ? track.rawPoints[0]
        : track.rawPoints[track.rawPoints.length - 1]

    if (!anchor) return false

    const delta = targetPoint.clone().sub(anchor)
    const distance = delta.length()
    if (distance <= spacing) return false

    const direction = delta.normalize()
    const steps = Math.floor(distance / spacing)
    let inserted = false

    for (let step = 1; step <= steps; step++) {
        const point = anchor.clone().addScaledVector(direction, spacing * step)
        if (!canAppendPoint(world, point)) {
            break
        }

        if (extendFromStart) {
            track.unshiftRawPoint(point)
        } else {
            track.pushRawPoint(point)
        }

        inserted = true
    }

    return inserted
}

function tryJoinTrackOnRelease(
    world: World,
    currentTrackId: number,
    extendFromStart: boolean,
    releasePoint: Vector3
) {
    const joinTarget = findJoinTargetOnRelease(world, releasePoint, currentTrackId, extendFromStart)
    if (!joinTarget) return

    if (joinTarget.trackId === currentTrackId) {
        closeTrackLoop(world, currentTrackId, extendFromStart)
        return
    }

    const joinTrack = world.getComponent(joinTarget.trackId, CTrack)
    if (!joinTrack) return

    if (joinTrack.immutable || joinTrack.isEndpointProtected(joinTarget.endpoint)) {
        snapTrackToExistingEndpoint(world, currentTrackId, extendFromStart, joinTrack, joinTarget.endpoint)
        return
    }

    mergeTracks(world, currentTrackId, extendFromStart, joinTarget.trackId, joinTarget.endpoint)
}

function eraseTrackAtPoint(
    world: World,
    trackId: number,
    eraseCenter: Vector3,
    eraseRadius: number
) {
    const track = world.getComponent(trackId, CTrack)
    if (!track || track.rawPoints.length === 0) return
    if (track.immutable) return

    const runs = splitRawPointRunsPreservingProtected(track.rawPoints, track.pointLocks, eraseCenter, eraseRadius)
    const survivingRuns = runs.filter(run => run.points.length >= 2)

    if (survivingRuns.length === 0) {
        FTrack.destroy(world, trackId)
        world.destroyEntity(trackId)
        return
    }

    applyRawPoints(track, survivingRuns[0].points, survivingRuns[0].locks)
    rebuildTrackGeometry(track)

    for (let i = 1; i < survivingRuns.length; i++) {
        const newTrackId = new FTrack().init(world)
        const newTrack = world.getComponent(newTrackId, CTrack)
        if (!newTrack) continue

        applyRawPoints(newTrack, survivingRuns[i].points, survivingRuns[i].locks)
        rebuildTrackGeometry(newTrack)
    }
}

function findJoinTargetOnRelease(
    world: World,
    p: Vector3,
    currentTrackId: number,
    extendFromStart: boolean
): { trackId: number, endpoint: "start" | "end" } | null {
    let closestTrackId: number | null = null
    let closestEndpoint: "start" | "end" | null = null
    let minDist = SNAP_DIST

    for (const [trackId, track] of world.query1(CTrack)) {
        if (track.rawPoints.length < 2) continue

        const first = track.rawPoints[0]
        const last = track.rawPoints[track.rawPoints.length - 1]

        if (trackId === currentTrackId) {
            if (!ALLOW_SELF_JOINS) continue

            const loopEndpoint = extendFromStart ? "end" : "start"
            const loopPoint = loopEndpoint === "start" ? first : last
            const loopDist = loopPoint.distanceTo(p)

            if (loopDist < minDist) {
                minDist = loopDist
                closestTrackId = trackId
                closestEndpoint = loopEndpoint
            }

            continue
        }

        const d1 = first.distanceTo(p)
        if (d1 < minDist) {
            minDist = d1
            closestTrackId = trackId
            closestEndpoint = "start"
        }

        const d2 = last.distanceTo(p)
        if (d2 < minDist) {
            minDist = d2
            closestTrackId = trackId
            closestEndpoint = "end"
        }
    }

    if (closestTrackId === null || closestEndpoint === null) return null

    return {
        trackId: closestTrackId,
        endpoint: closestEndpoint
    }
}

function mergeTracks(
    world: World,
    primaryTrackId: number,
    extendFromStart: boolean,
    secondaryTrackId: number,
    secondaryEndpoint: "start" | "end"
) {
    const primaryTrack = world.getComponent(primaryTrackId, CTrack)
    const secondaryTrack = world.getComponent(secondaryTrackId, CTrack)
    if (!primaryTrack || !secondaryTrack || secondaryTrack.rawPoints.length < 2 || secondaryTrack.immutable) return

    const targetPoint = secondaryEndpoint === "start"
        ? secondaryTrack.rawPoints[0].clone()
        : secondaryTrack.rawPoints[secondaryTrack.rawPoints.length - 1].clone()

    const primaryData = cloneTrackData(primaryTrack)
    const secondaryData = cloneTrackData(secondaryTrack)
    if (primaryData.length === 0) return

    if (extendFromStart) {
        primaryData[0] = { ...primaryData[0], point: targetPoint.clone() }

        const prefix = secondaryEndpoint === "end"
            ? secondaryData.slice(0, -1)
            : secondaryData.slice().reverse().slice(0, -1)

        applyRawPoints(
            primaryTrack,
            [...prefix, ...primaryData].map(entry => entry.point),
            [...prefix, ...primaryData].map(entry => entry.lock)
        )
    } else {
        const lastIndex = primaryData.length - 1
        primaryData[lastIndex] = { ...primaryData[lastIndex], point: targetPoint.clone() }

        const suffix = secondaryEndpoint === "start"
            ? secondaryData.slice(1)
            : secondaryData.slice().reverse().slice(1)

        applyRawPoints(
            primaryTrack,
            [...primaryData, ...suffix].map(entry => entry.point),
            [...primaryData, ...suffix].map(entry => entry.lock)
        )
    }

    rebuildTrackGeometry(primaryTrack)
    FTrack.destroy(world, secondaryTrackId)
    world.destroyEntity(secondaryTrackId)
}

function closeTrackLoop(
    world: World,
    trackId: number,
    extendFromStart: boolean
) {
    const track = world.getComponent(trackId, CTrack)
    if (!track || track.rawPoints.length < 2) return

    const loopPoint = extendFromStart
        ? track.rawPoints[track.rawPoints.length - 1].clone()
        : track.rawPoints[0].clone()

    if (extendFromStart) {
        track.replaceRawPoint(0, loopPoint)
    } else {
        track.replaceRawPoint(track.rawPoints.length - 1, loopPoint)
    }

    rebuildTrackGeometry(track)
}

function splitRawPointRunsPreservingProtected(
    rawPoints: Vector3[],
    pointLocks: TrackPointLock[],
    eraseCenter: Vector3,
    eraseRadius: number
): RawPointRun[] {
    const runs: RawPointRun[] = []
    let currentRun: RawPointRun = { points: [], locks: [] }

    for (let i = 0; i < rawPoints.length; i++) {
        const point = rawPoints[i]
        const lock = pointLocks[i] ?? "free"
        const isProtected = lock === "protected"

        if (!isProtected && point.distanceTo(eraseCenter) <= eraseRadius) {
            if (currentRun.points.length > 0) {
                runs.push(currentRun)
                currentRun = { points: [], locks: [] }
            }

            continue
        }

        currentRun.points.push(point.clone())
        currentRun.locks.push(lock)
    }

    if (currentRun.points.length > 0) {
        runs.push(currentRun)
    }

    return runs
}

function applyRawPoints(track: CTrack, rawPoints: Vector3[], pointLocks?: TrackPointLock[]) {
    track.setRawPoints(rawPoints, pointLocks)
}

function rebuildTrackGeometry(track: CTrack) {
    if (track.rawPoints.length < 2) {
        track.physicsPoints = []
        track.cumulativeLengths = []
        track.trackLength = 0
        track.sampled = []

        if (track.lineMesh) {
            track.lineMesh.geometry.dispose()
            track.lineMesh.geometry = new BufferGeometry()
        }

        return
    }

    // Physics follows the local smoothed rail, while the rendered line can stay uniformly sampled.
    const rail = buildTrackRail(track.rawPoints, PHYSICS_POINT_SPACING, RAIL_SMOOTHING_PASSES)
    track.physicsPoints = rail.physicsPoints
    track.cumulativeLengths = rail.cumulativeLengths
    track.trackLength = rail.trackLength
    track.sampled = rail.sampledPoints.map(point => point.clone())

    if (track.lineMesh) {
        track.lineMesh.geometry.dispose()
        track.lineMesh.geometry = new BufferGeometry().setFromPoints(track.sampled)
    }
}


function findClosestEndpoint(
    world: World,
    p: Vector3,
    maxDist: number
): { trackId: number, endpoint: "start" | "end" } | null {

    let closestTrackId: number | null = null
    let closestEndpoint: "start" | "end" | null = null
    let minDist = maxDist

    for (const [trackId, track] of world.query1(CTrack)) {
        if (track.rawPoints.length < 2) continue

        const first = track.rawPoints[0]

        const last = track.rawPoints[track.rawPoints.length - 1]

        // check start
        const d1 = first.distanceTo(p)
        if (d1 < minDist) {
            minDist = d1
            closestTrackId = trackId
            closestEndpoint = "start"
        }

        // check end
        const d2 = last.distanceTo(p)
        if (d2 < minDist) {
            minDist = d2
            closestTrackId = trackId
            closestEndpoint = "end"
        }
    }

    if (closestTrackId === null || closestEndpoint === null) return null

    return {
        trackId: closestTrackId,
        endpoint: closestEndpoint
    }
}

function findClosestTrack(
    world: World,
    p: Vector3,
    maxDist: number
): number | null {

    let closestTrackId: number | null = null
    let minDist = maxDist

    for (const [trackId, track] of world.query1(CTrack)) {
        if (track.immutable) continue

        if (!track.sampled || track.sampled.length < 2) continue

        for (let i = 0; i < track.sampled.length - 1; i++) {
            const a = track.sampled[i]
            const b = track.sampled[i + 1]
            if (!a || !b) continue

            const d = distanceToSegment(p, a, b)

            if (d < minDist) {
                minDist = d
                closestTrackId = trackId
            }
        }
    }

    return closestTrackId
}

function distanceToSegment(p: Vector3, a: Vector3, b: Vector3): number {
    const ab = b.clone().sub(a)
    const lenSq = ab.lengthSq()
    if (lenSq === 0) return p.distanceTo(a)

    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / lenSq))
    const closestPoint = a.clone().add(ab.multiplyScalar(t))

    return p.distanceTo(closestPoint)
}

function getTrackEndpointPoint(track: CTrack, endpoint: "start" | "end") {
    return endpoint === "start"
        ? track.rawPoints[0]?.clone() ?? null
        : track.rawPoints[track.rawPoints.length - 1]?.clone() ?? null
}

function snapTrackToExistingEndpoint(
    world: World,
    trackId: number,
    extendFromStart: boolean,
    targetTrack: CTrack,
    targetEndpoint: "start" | "end"
) {
    const track = world.getComponent(trackId, CTrack)
    if (!track) return

    const targetPoint = getTrackEndpointPoint(targetTrack, targetEndpoint)
    if (!targetPoint) return

    if (extendFromStart) {
        track.replaceRawPoint(0, targetPoint)
    } else {
        track.replaceRawPoint(track.rawPoints.length - 1, targetPoint)
    }

    rebuildTrackGeometry(track)
}

function cloneTrackData(track: CTrack) {
    return track.rawPoints.map((point, index) => ({
        point: point.clone(),
        lock: track.getPointLock(index),
    }))
}

function findBlockingObstacle(world: World, point: Vector3) {
    for (const [_entityId, obstacle, position] of world.query2(CObstacle, CPosition)) {
        if (position.position.distanceTo(point) <= obstacle.radius) {
            return obstacle
        }
    }

    return null
}

function canAppendPoint(world: World, point: Vector3) {
    return findBlockingObstacle(world, point) === null
}
