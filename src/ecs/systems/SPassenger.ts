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

const GRAVITY = 3;
const REATTACH_DIST = 0.22;
const AIRTIME_COOLDOWN = 0.5;
const REATTACH_COOLDOWN = 0.2;

const DETACH_BOOST = 0;

const AIR_SPIN_SPEED_X = 0;
const AIR_SPIN_SPEED_Z = -7;

const SUPPORT_THRESHOLD = -7.0; // if the support force (centripetal - gravity) is below this, the passenger is at risk of falling out. This is a soft threshold that can be exceeded briefly without detaching, allowing for more dynamic movement without constant minor detachments.
const AIRBORNE_SUPPORT_THRESHOLD = -2; // when off-track, a much lower threshold is used since the passenger isn't being held in by the track at all. This allows for more forgiving reattachment after a fall.
const REATTACH_EPSILON = 1e-6;
const DEBUG_REATTACH_DIAGNOSTICS = false;
const REATTACH_DIST_SQ = REATTACH_DIST * REATTACH_DIST;

const reattachSeatPosition = new Vector3();

type PassengerReattachCandidate = {
    cartId: number;
    seatPosition: Vector3;
    cartVelocity: Vector3;
    cartRotation?: CRotation;
    distanceSq: number;
};

export class SPassenger extends System {

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
        } else {
            pos.position.copy(passenger.spawnPosition)
            pos.previousPosition.copy(passenger.spawnPosition)
            passenger.attached = false
            passenger.cartId = null
        }

        pos.dirty = true
        vel.velocity.set(0, 0, 0)

        passenger.airtimeCooldown = 0
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

    private detachPassenger(passenger: CPassenger, vel: CVelocity, cartVelocity: Vector3) {
        passenger.attached = false;
        passenger.cartId = null;
        passenger.airtimeCooldown = REATTACH_COOLDOWN;

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
            const cartVel = world.getComponent(cartId, CVelocity)!;
            const cartRot = world.getComponent(cartId, CRotation);
            const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset).clone();
            const distanceSq = seatPosition.distanceToSquared(pos.position);

            if (distanceSq > REATTACH_DIST_SQ + REATTACH_EPSILON) continue;

            const candidate: PassengerReattachCandidate = {
                cartId,
                seatPosition,
                cartVelocity: cartVel.velocity.clone(),
                cartRotation: cartRot,
                distanceSq,
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
                passenger.airtimeCooldown = Math.max(0, passenger.airtimeCooldown - dt);

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

                    const shouldDetach =
                        passenger.airtimeCooldown <= 0 &&
                        lacksSupport;

                    if (shouldDetach) {
                        this.detachPassenger(passenger, vel, cartVel.velocity);
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
                if (passenger.airtimeCooldown > 0) continue;
                const bestCandidate = this.findBestReattachCandidate(world, passenger, pos);

                if (!bestCandidate) continue;

                passenger.attached = true;
                passenger.cartId = bestCandidate.cartId;

                pos.position.copy(bestCandidate.seatPosition);
                pos.dirty = true;

                passenger.airtimeCooldown = AIRTIME_COOLDOWN;

                vel.velocity.copy(bestCandidate.cartVelocity);

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

    const angle = cartRotation ? cartRotation.rotation.z : 0

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const rightX = cos
    const rightY = sin

    const upX = -sin
    const upY = cos

    const x = seatOffset.x * rightX + seatOffset.y * upX
    const y = seatOffset.x * rightY + seatOffset.y * upY

    return reattachSeatPosition.set(
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

    return candidate.cartId < current.cartId;
}
