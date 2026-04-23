import { BufferGeometry, CatmullRomCurve3, Vector3 } from "three"
import { System } from "../core/system"
import { RInput } from "../resources/RInput"
import { CTrack } from "../components/CTrack"
import { RRaycast } from "../resources/RRaycast"
import { RTrackManager } from "../resources/RTrackManager"
import { World } from "../core/world"
import { FTrack } from "../factories/trackFactory"
import { ESimulationState, RSimulationState } from "../resources/RSimulationState"

const MIN_DIST = 0.3
const SNAP_DIST = 0.2
const ERASE_RADIUS = 0.45
const MIN_RAW_POINTS_TO_KEEP = 3
const ALLOW_SELF_JOINS = false

export class SDrawTrack extends System {

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!
        const drawing = world.getResource(RTrackManager)!
        const raycast = world.getResource(RRaycast)!

        const simulationState = world.getResource(RSimulationState)!
        if (simulationState.state !== ESimulationState.DrawingTrack) return

        // put on erase mode if E is pressed, otherwise draw mode
        
        if (input.keysPressed.has("e")) {
            if (simulationState.drawingMode == "erase") {
                simulationState.drawingMode = "draw"
            }
            else {
                simulationState.drawingMode = "erase"
            }
            
        } 

        const drawingMode = simulationState.drawingMode // draw || erase

        if (drawingMode === "erase") {
            // Erase continuously while holding the mouse button.
            if (input.lmbDown) {
                const mouse = raycast.hitPoint.clone()
                mouse.z = 0

                const hit = findClosestTrack(world, mouse, ERASE_RADIUS)

                if (hit !== null) {
                    eraseTrackAtPoint(world, hit, mouse, ERASE_RADIUS)
                }
            }

            return;
        }



        // Start drawing or extend an existing snapped endpoint.
        if (input.lmbPressed) {
            const mouse = raycast.hitPoint.clone()
            mouse.z = 0

            const snap = findClosestEndpoint(world, mouse, SNAP_DIST)

            if (snap) {
                drawing.currentTrackId = snap.trackId
                drawing.extendFromStart = snap.endpoint === "start"
            } else {
                const entity = new FTrack().init(world)
                const track = world.getComponent(entity, CTrack)!
                track.rawPoints.push(mouse)
                drawing.currentTrackId = entity
                drawing.extendFromStart = false
            }
        }

        // 🔹 Stop drawing and optionally snap into a second track endpoint.
        if (input.lmbReleased && drawing.currentTrackId !== null) {
            const mouse = raycast.hitPoint.clone()
            mouse.z = 0

            tryJoinTrackOnRelease(world, drawing.currentTrackId, drawing.extendFromStart, mouse)

            const track = world.getComponent(drawing.currentTrackId, CTrack)

            if (track && track.rawPoints.length < 2) {
                FTrack.destroy(world, drawing.currentTrackId)
                world.destroyEntity(drawing.currentTrackId)
            }

            drawing.currentTrackId = null
            drawing.extendFromStart = false
            return
        }

        // 🔹 Nothing to draw
        if (drawing.currentTrackId === null) return

        const track = world.getComponent(drawing.currentTrackId, CTrack)
        if (!track) return

        let dirty = false

        // 🔹 Add points
        if (input.lmbDown) {
            const p = raycast.hitPoint.clone()
            p.z = 0

            const anchor = drawing.extendFromStart
                ? track.rawPoints[0]
                : track.rawPoints[track.rawPoints.length - 1]

            if (!anchor || anchor.distanceTo(p) > MIN_DIST) {
                if (drawing.extendFromStart) {
                    track.rawPoints.unshift(p)
                } else {
                    track.rawPoints.push(p)
                }

                dirty = true
            }
        }

        // 🔹 Rebuild spline
        if (dirty) {
            rebuildTrackGeometry(track)
        }
    }
}

// Try a second endpoint snap on release so a stroke can merge into another track.
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

    mergeTracks(world, currentTrackId, extendFromStart, joinTarget.trackId, joinTarget.endpoint)
}

// Erase raw control points near the cursor, then shrink, split, or delete the track.
function eraseTrackAtPoint(
    world: World,
    trackId: number,
    eraseCenter: Vector3,
    eraseRadius: number
) {
    const track = world.getComponent(trackId, CTrack)
    if (!track || track.rawPoints.length === 0) return

    const runs = splitRawPointRuns(track.rawPoints, eraseCenter, eraseRadius)
    const survivingRuns = runs.filter(run => run.length >= MIN_RAW_POINTS_TO_KEEP)

    // If no valid run survives, the eraser removed the whole track.
    if (survivingRuns.length === 0) {
        FTrack.destroy(world, trackId)
        world.destroyEntity(trackId)
        return
    }

    // Reuse the original entity for the first surviving run.
    applyRawPoints(track, survivingRuns[0])
    rebuildTrackGeometry(track)

    // Create additional track entities for any extra surviving runs.
    for (let i = 1; i < survivingRuns.length; i++) {
        const newTrackId = new FTrack().init(world)
        const newTrack = world.getComponent(newTrackId, CTrack)
        if (!newTrack) continue

        applyRawPoints(newTrack, survivingRuns[i])
        rebuildTrackGeometry(newTrack)
    }
}

// Find the endpoint that can receive the release-time snap, including optional self-joins.
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

// Merge a released stroke into another track and clean up the merged-away entity.
function mergeTracks(
    world: World,
    primaryTrackId: number,
    extendFromStart: boolean,
    secondaryTrackId: number,
    secondaryEndpoint: "start" | "end"
) {
    const primaryTrack = world.getComponent(primaryTrackId, CTrack)
    const secondaryTrack = world.getComponent(secondaryTrackId, CTrack)
    if (!primaryTrack || !secondaryTrack || secondaryTrack.rawPoints.length < 2) return

    const targetPoint = secondaryEndpoint === "start"
        ? secondaryTrack.rawPoints[0].clone()
        : secondaryTrack.rawPoints[secondaryTrack.rawPoints.length - 1].clone()

    const primaryPoints = primaryTrack.rawPoints.map(point => point.clone())
    if (primaryPoints.length === 0) return

    if (extendFromStart) {
        primaryPoints[0] = targetPoint.clone()

        const prefix = secondaryEndpoint === "end"
            ? secondaryTrack.rawPoints.slice(0, -1)
            : secondaryTrack.rawPoints.slice().reverse().slice(0, -1)

        applyRawPoints(primaryTrack, [...prefix, ...primaryPoints])
    } else {
        primaryPoints[primaryPoints.length - 1] = targetPoint.clone()

        const suffix = secondaryEndpoint === "start"
            ? secondaryTrack.rawPoints.slice(1)
            : secondaryTrack.rawPoints.slice().reverse().slice(1)

        applyRawPoints(primaryTrack, [...primaryPoints, ...suffix])
    }

    rebuildTrackGeometry(primaryTrack)
    FTrack.destroy(world, secondaryTrackId)
    world.destroyEntity(secondaryTrackId)
}

// Close the active track onto its opposite endpoint when self-joins are enabled.
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
        track.rawPoints[0] = loopPoint
    } else {
        track.rawPoints[track.rawPoints.length - 1] = loopPoint
    }

    rebuildTrackGeometry(track)
}

// Split the track's raw points into contiguous survivors outside the eraser radius.
function splitRawPointRuns(
    rawPoints: Vector3[],
    eraseCenter: Vector3,
    eraseRadius: number
): Vector3[][] {
    const runs: Vector3[][] = []
    let currentRun: Vector3[] = []

    for (const point of rawPoints) {
        if (point.distanceTo(eraseCenter) <= eraseRadius) {
            if (currentRun.length > 0) {
                runs.push(currentRun)
                currentRun = []
            }

            continue
        }

        currentRun.push(point.clone())
    }

    if (currentRun.length > 0) {
        runs.push(currentRun)
    }

    return runs
}

// Copy a raw-point run onto a track so the run can become the new source spline.
function applyRawPoints(track: CTrack, rawPoints: Vector3[]) {
    track.rawPoints = rawPoints.map(point => point.clone())
}

// Rebuild all derived spline/render data from the track's raw points.
function rebuildTrackGeometry(track: CTrack) {
    if (track.rawPoints.length < 2) {
        track.curve = null
        track.curveLength = 0
        track.sampled = []

        if (track.lineMesh) {
            track.lineMesh.geometry.dispose()
            track.lineMesh.geometry = new BufferGeometry()
        }

        return
    }

    track.curve = new CatmullRomCurve3(track.rawPoints)
    track.curveLength = track.curve.getLength()
    track.sampled = track.curve.getSpacedPoints(Math.min(200, track.rawPoints.length * 10))

    if (track.lineMesh) {
        track.lineMesh.geometry.dispose()
        track.lineMesh.geometry = new BufferGeometry().setFromPoints(track.sampled)
    }
}


// Helper: find closest track endpoint.
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