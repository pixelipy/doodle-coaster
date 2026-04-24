import { Vector3 } from "three";
import { CCart } from "../components/CCart";
import { CPassenger } from "../components/CPassenger";
import { CPosition, CRotation } from "../components/CTransform";
import { CVelocity } from "../components/CVelocity";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { CTrack } from "../components/CTrack";
import { RTime } from "../resources/RTime";
import { sampleTrackRailAtDistance } from "../utils/trackRail";
import { RSettings } from "../resources/RSettings";

let GRAVITY = 3;
let REATTACH_DIST = 0.25;
let MIN_SEPARATION_BEFORE_REATTACHING = 0.4; // After detaching, the passenger must get at least this far from that same cart's seat before it can be caught again.
let DETACH_BOOST = 0.25;
let AIR_SPIN_SPEED_X = 0;
let AIR_SPIN_SPEED_Z = -7;
let SUPPORT_THRESHOLD = -10.0; // if the support force (centripetal - gravity) is below this, the passenger is at risk of falling out. This is a soft threshold that can be exceeded briefly without detaching, allowing for more dynamic movement without constant minor detachments.
let AIRBORNE_SUPPORT_THRESHOLD = -3; // when off-track, a much lower threshold is used since the passenger isn't being held in by the track at all. This allows for more forgiving reattachment after a fall.

const REATTACH_EPSILON = 1e-6;
const DEBUG_REATTACH_DIAGNOSTICS = false;
const REATTACH_DIST_SQ = REATTACH_DIST * REATTACH_DIST;

const reattachSeatPosition = new Vector3();

type PassengerReattachCandidate = {
    cartId: number;
    seatPosition: Vector3;
    previousSeatPosition: Vector3;
    cartRotation?: CRotation;
    distanceSq: number;
    endDistanceSq: number;
};

export class SPassenger extends System {

    init(world: World): void {
        let settings = world.getResource(RSettings)!

        GRAVITY = settings.physics.GRAVITY
        REATTACH_DIST = settings.passenger.REATTACH_DIST
        MIN_SEPARATION_BEFORE_REATTACHING = settings.passenger.MIN_SEPARATION_BEFORE_REATTACHING
        DETACH_BOOST = settings.passenger.DETACH_BOOST
        AIR_SPIN_SPEED_X = settings.passenger.AIR_SPIN_SPEED_X
        AIR_SPIN_SPEED_Z = settings.passenger.AIR_SPIN_SPEED_Z
        SUPPORT_THRESHOLD = settings.passenger.SUPPORT_THRESHOLD
        AIRBORNE_SUPPORT_THRESHOLD = settings.passenger.AIRBORNE_SUPPORT_THRESHOLD
    }

    private beginInterpolatedStep(pos: CPosition, rotation?: CRotation) {
        pos.previousPosition.copy(pos.position)

        if (rotation) {
            rotation.previousRotation.copy(rotation.rotation)
        }
    }

    private resetPassenger(world: World, entity: number, pos: CPosition, vel: CVelocity, passenger: CPassenger) {
        const rotation = world.getComponent(entity, CRotation)
        const homeCartPosition = passenger.homeCartId !== null
            ? world.getComponent(passenger.homeCartId, CPosition)
            : undefined
        const homeCartRotation = passenger.homeCartId !== null
            ? world.getComponent(passenger.homeCartId, CRotation)
            : undefined

        if (homeCartPosition) {
            pos.position.copy(getSeatPosition(homeCartPosition.position, homeCartRotation, passenger.offset))
            pos.previousPosition.copy(pos.position)
            passenger.attached = true
            passenger.cartId = passenger.homeCartId
            passenger.previousSeatDistance = 0
            passenger.needsSeparation = false
            passenger.separationCartId = null
        } else {
            pos.position.copy(passenger.spawnPosition)
            pos.previousPosition.copy(passenger.spawnPosition)
            passenger.attached = false
            passenger.cartId = null
            passenger.previousSeatDistance = Infinity
            passenger.needsSeparation = false
            passenger.separationCartId = null
        }

        pos.dirty = true
        vel.velocity.set(0, 0, 0)

        passenger.airtimeTimer = 0

        if (rotation) {
            if (homeCartRotation) {
                rotation.rotation.copy(homeCartRotation.rotation)
            } else {
                rotation.rotation.set(0, 0, 0)
            }

            rotation.previousRotation.copy(rotation.rotation)

            rotation.dirty = true
        }
    }

    private detachPassenger(passenger: CPassenger, cartId: number, vel: CVelocity, cartVelocity: Vector3) {
        passenger.attached = false;
        passenger.cartId = null;
        passenger.previousSeatDistance = 0;
        passenger.needsSeparation = true;
        passenger.separationCartId = cartId;

        vel.velocity.copy(cartVelocity);
        vel.velocity.y += DETACH_BOOST;
    }

    private estimateSupportForce(
        cart: CCart,
        cartVel: CVelocity,
        cartRot: CRotation | undefined,
        track: CTrack | null
    ) {
        const tangent = new Vector3(
            Math.cos(cartRot?.rotation.z ?? 0),
            Math.sin(cartRot?.rotation.z ?? 0),
            0
        );
        const normal = new Vector3(-tangent.y, tangent.x, 0);
        const gravityNormal = new Vector3(0, -GRAVITY, 0).dot(normal);

        if (!cart.attached || !track || track.physicsPoints.length < 2 || track.trackLength <= 0) {
            return cartVel.velocity.dot(normal);
        }

        const distanceSample = 0.1;
        const d1 = Math.max(0, cart.distanceAlongTrack - distanceSample);
        const d2 = Math.min(track.trackLength, cart.distanceAlongTrack + distanceSample);
        const sample1 = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            d1
        );
        const sample2 = sampleTrackRailAtDistance(
            track.physicsPoints,
            track.cumulativeLengths,
            track.trackLength,
            d2
        );

        if (!sample1 || !sample2) {
            return cartVel.velocity.dot(normal);
        }

        const tan1 = sample1.tangent.clone().normalize();
        const tan2 = sample2.tangent.clone().normalize();
        const tangentDelta = tan2.sub(tan1);
        const ds = Math.max(d2 - d1, 0.0001);
        const signedCurvature = tangentDelta.dot(normal) / ds;
        const centripetal = cartVel.velocity.lengthSq() * signedCurvature;

        return centripetal - gravityNormal;
    }

    private findBestReattachCandidate(
        world: World,
        passenger: CPassenger,
        pos: CPosition
    ) {
        let bestCandidate: PassengerReattachCandidate | null = null;
        const debugCandidates: PassengerReattachCandidate[] = [];

        for (const [cartId, _cart, cartPos] of world.query2(CCart, CPosition)) {
            const cartRot = world.getComponent(cartId, CRotation);
            const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset).clone();
            const previousSeatPosition = getSeatPositionAt(
                cartPos.previousPosition,
                cartRot?.previousRotation.z ?? 0,
                passenger.offset
            );
            const closest = closestPointsBetweenSegments(
                pos.previousPosition,
                pos.position,
                previousSeatPosition,
                seatPosition
            );
            if (!closest || closest.distanceSq > REATTACH_DIST_SQ + REATTACH_EPSILON) continue;

            const candidate: PassengerReattachCandidate = {
                cartId,
                seatPosition,
                previousSeatPosition,
                cartRotation: cartRot,
                distanceSq: closest.distanceSq,
                endDistanceSq: closest.pointOnFirst.distanceToSquared(pos.position),
            };

            if (DEBUG_REATTACH_DIAGNOSTICS) {
                debugCandidates.push(candidate);
            }

            if (isBetterPassengerReattachCandidate(candidate, bestCandidate)) {
                bestCandidate = candidate;
            }
        }

        if (bestCandidate && DEBUG_REATTACH_DIAGNOSTICS) {
            console.log("[SPassenger reattach]", {
                winnerCartId: bestCandidate.cartId,
                winnerDistanceSq: bestCandidate.distanceSq,
                candidateCount: debugCandidates.length,
                candidates: debugCandidates
                    .slice()
                    .sort((a, b) => a.distanceSq - b.distanceSq || a.cartId - b.cartId)
                    .map(candidate => ({
                        cartId: candidate.cartId,
                        distanceSq: candidate.distanceSq,
                    })),
            });
        }

        return bestCandidate;
    }

    private hasClearedSeparationDistance(world: World, passenger: CPassenger, pos: CPosition) {
        if (!passenger.needsSeparation) return true;

        const separationCartId = passenger.separationCartId;
        if (separationCartId === null) {
            passenger.needsSeparation = false;
            return true;
        }

        const cartPos = world.getComponent(separationCartId, CPosition);
        if (!cartPos) {
            passenger.needsSeparation = false;
            passenger.separationCartId = null;
            return true;
        }

        const cartRot = world.getComponent(separationCartId, CRotation);
        const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset);
        const distanceSq = seatPosition.distanceToSquared(pos.position);
        const requiredDistanceSq = MIN_SEPARATION_BEFORE_REATTACHING * MIN_SEPARATION_BEFORE_REATTACHING;
        if (distanceSq >= requiredDistanceSq - REATTACH_EPSILON) {
            passenger.needsSeparation = false;
            passenger.separationCartId = null;
            return true;
        }

        return false;
    }

    update(world: World, _dt: number): void {

        const sim = world.getResource(RSimulationState)!;
        const time = world.getResource(RTime)!;

        if (sim.state === ESimulationState.DrawingTrack) {
            for (const [entity, pos, vel, passenger] of world.query3(CPosition, CVelocity, CPassenger)) {
                this.resetPassenger(world, entity, pos, vel, passenger)
            }
            return;
        }

        if (sim.state !== ESimulationState.Playing) return;
        if (time.pendingFixedSteps <= 0) return;

        for (let step = 0; step < time.pendingFixedSteps; step++) {
            const dt = time.fixedTimestep

            for (const [_e, pos, vel, passenger] of world.query3(CPosition, CVelocity, CPassenger)) {

                const rotation = world.getComponent(_e, CRotation);
                this.beginInterpolatedStep(pos, rotation)

                // -------------------------
                // ATTACHED
                // -------------------------
                if (passenger.attached && passenger.cartId !== null) {
                    const cart = world.getComponent(passenger.cartId, CCart);
                    const cartPos = world.getComponent(passenger.cartId, CPosition);
                    const cartVel = world.getComponent(passenger.cartId, CVelocity);
                    const cartRot = world.getComponent(passenger.cartId, CRotation);

                    if (!cart || !cartPos || !cartVel) {
                        passenger.attached = false;
                        passenger.cartId = null;
                        passenger.previousSeatDistance = Infinity;
                        continue;
                    }

                    const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset);

                    const track = cart.trackId !== null
                        ? world.getComponent(cart.trackId, CTrack)!
                        : null;

                    // Support is estimated from rail curvature when on-track, and from cart motion when airborne.
                    const supportForce = this.estimateSupportForce(cart, cartVel, cartRot, track);
                    const lacksSupport = supportForce <= (cart.attached ? SUPPORT_THRESHOLD : AIRBORNE_SUPPORT_THRESHOLD);

                    if (rotation && cartRot) {
                        rotation.rotation.copy(cartRot.rotation);
                        rotation.dirty = true;
                    }

                    const shouldDetach = lacksSupport;

                    if (shouldDetach) {
                        this.detachPassenger(passenger, passenger.cartId, vel, cartVel.velocity);
                        continue;
                    }

                    // Attached passengers snap to the current seat transform each step.
                    pos.position.copy(seatPosition);
                    pos.dirty = true;

                    continue;
                }

                // -------------------------
                // FREE
                // -------------------------

                pos.position.addScaledVector(vel.velocity, dt);
                vel.velocity.y -= GRAVITY * passenger.weight * dt;
                pos.dirty = true;

                if (rotation) {
                    rotation.rotation.x += AIR_SPIN_SPEED_X * dt;
                    rotation.rotation.z += AIR_SPIN_SPEED_Z * dt;
                    rotation.dirty = true;
                }

                // -------------------------
                // REATTACH
                // -------------------------
                if (!this.hasClearedSeparationDistance(world, passenger, pos)) {
                    continue;
                }

                const bestCandidate = this.findBestReattachCandidate(world, passenger, pos);
                if (!bestCandidate) {
                    passenger.previousSeatDistance = Infinity;
                    continue;
                }

                const seatVelocity = bestCandidate.seatPosition
                    .clone()
                    .sub(bestCandidate.previousSeatPosition)
                    .divideScalar(dt);

                passenger.attached = true;
                passenger.cartId = bestCandidate.cartId;
                passenger.previousSeatDistance = 0;
                passenger.needsSeparation = false;
                passenger.separationCartId = null;

                pos.position.copy(bestCandidate.seatPosition);
                pos.dirty = true;

                vel.velocity.copy(seatVelocity);

                if (rotation && bestCandidate.cartRotation) {
                    rotation.rotation.copy(bestCandidate.cartRotation.rotation);
                    rotation.dirty = true;
                }
            }
        }
    }
}

function getSeatPosition(
    cartPosition: Vector3,
    cartRotation: CRotation | undefined,
    seatOffset: Vector3
): Vector3 {
    return getSeatPositionAt(
        cartPosition,
        cartRotation ? cartRotation.rotation.z : 0,
        seatOffset,
        reattachSeatPosition
    );
}

function getSeatPositionAt(
    cartPosition: Vector3,
    angle: number,
    seatOffset: Vector3,
    target: Vector3 = new Vector3()
): Vector3 {

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const rightX = cos
    const rightY = sin

    const upX = -sin
    const upY = cos

    const x = seatOffset.x * rightX + seatOffset.y * upX
    const y = seatOffset.x * rightY + seatOffset.y * upY

    return target.set(
        cartPosition.x + x,
        cartPosition.y + y,
        cartPosition.z + seatOffset.z
    )
}

function isBetterPassengerReattachCandidate(
    candidate: PassengerReattachCandidate,
    current: PassengerReattachCandidate | null
): boolean {
    if (!current) return true;
    if (candidate.distanceSq < current.distanceSq - REATTACH_EPSILON) return true;
    if (candidate.distanceSq > current.distanceSq + REATTACH_EPSILON) return false;

    if (candidate.endDistanceSq < current.endDistanceSq - REATTACH_EPSILON) return true;
    if (candidate.endDistanceSq > current.endDistanceSq + REATTACH_EPSILON) return false;

    return candidate.cartId < current.cartId;
}

function closestPointsBetweenSegments(
    p1: Vector3,
    p2: Vector3,
    q1: Vector3,
    q2: Vector3
): { pointOnFirst: Vector3, pointOnSecond: Vector3, distanceSq: number, tFirst: number, tSecond: number } | null {
    const d1 = p2.clone().sub(p1)
    const d2 = q2.clone().sub(q1)
    const r = p1.clone().sub(q1)
    const a = d1.dot(d1)
    const e = d2.dot(d2)
    const f = d2.dot(r)

    let s = 0
    let t = 0

    if (a <= REATTACH_EPSILON && e <= REATTACH_EPSILON) {
        return {
            pointOnFirst: p1.clone(),
            pointOnSecond: q1.clone(),
            distanceSq: p1.distanceToSquared(q1),
            tFirst: 0,
            tSecond: 0,
        }
    }

    if (a <= REATTACH_EPSILON) {
        s = 0
        t = clamp01(f / e)
    } else {
        const c = d1.dot(r)

        if (e <= REATTACH_EPSILON) {
            t = 0
            s = clamp01(-c / a)
        } else {
            const b = d1.dot(d2)
            const denom = a * e - b * b

            if (Math.abs(denom) > REATTACH_EPSILON) {
                s = clamp01((b * f - c * e) / denom)
            }

            const tNumerator = b * s + f

            if (tNumerator <= 0) {
                t = 0
                s = clamp01(-c / a)
            } else if (tNumerator >= e) {
                t = 1
                s = clamp01((b - c) / a)
            } else {
                t = tNumerator / e
            }
        }
    }

    const pointOnFirst = p1.clone().addScaledVector(d1, s)
    const pointOnSecond = q1.clone().addScaledVector(d2, t)

    return {
        pointOnFirst,
        pointOnSecond,
        distanceSq: pointOnFirst.distanceToSquared(pointOnSecond),
        tFirst: s,
        tSecond: t,
    }
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, value))
}
