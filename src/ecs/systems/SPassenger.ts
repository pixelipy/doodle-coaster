import { Vector3 } from "three";
import { CCart } from "../components/CCart";
import { CPassenger } from "../components/CPassenger";
import { CPosition, CRotation } from "../components/CTransform";
import { CVelocity } from "../components/CVelocity";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { CTrack } from "../components/CTrack";

const GRAVITY = 3;
const REATTACH_DIST = 0.15;
const AIRTIME_COOLDOWN = 0.5;
const REATTACH_COOLDOWN = 0.2;

const DETACH_BOOST = 1;

const AIR_SPIN_SPEED_X = 0;
const AIR_SPIN_SPEED_Z = -7;

const SUPPORT_THRESHOLD = -5.0; // if the support force (centripetal - gravity) is below this, the passenger is at risk of falling out. This is a soft threshold that can be exceeded briefly without detaching, allowing for more dynamic movement without constant minor detachments.
const AIRBORNE_SUPPORT_THRESHOLD = -2; // when off-track, a much lower threshold is used since the passenger isn't being held in by the track at all. This allows for more forgiving reattachment after a fall.

const reattachSeatPosition = new Vector3();
const tempVec = new Vector3();

export class SPassenger extends System {

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
            passenger.attached = true
            passenger.cartId = passenger.homeCartId
        } else {
            pos.position.copy(passenger.spawnPosition)
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

            rotation.dirty = true
        }
    }

    update(world: World, dt: number): void {

        const sim = world.getResource(RSimulationState)!;
        const passengers = world.query3(CPosition, CVelocity, CPassenger);

        if (sim.state === ESimulationState.DrawingTrack) {
            for (const [entity, pos, vel, passenger] of passengers) {
                this.resetPassenger(world, entity, pos, vel, passenger)
            }
            return;
        }

        if (sim.state !== ESimulationState.Playing) return;

        for (const [_e, pos, vel, passenger] of passengers) {

            const rotation = world.getComponent(_e, CRotation);
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

                const dist = seatPosition.distanceTo(pos.position);
                const normalizedDist = dist / (passenger.offset.length() + 0.001);

                tempVec.copy(vel.velocity).sub(cartVel.velocity);
                const relativeSpeed = tempVec.length();

                // -------------------------
                // REAL SUPPORT FORCE
                // -------------------------

                const track = cart.trackId !== null
                    ? world.getComponent(cart.trackId, CTrack)
                    : null;

                const tangent = new Vector3(
                    Math.cos(cartRot?.rotation.z ?? 0),
                    Math.sin(cartRot?.rotation.z ?? 0),
                    0
                );

                const normal = new Vector3(-tangent.y, tangent.x, 0);

                const gravityVec = new Vector3(0, -GRAVITY, 0);
                const gravityNormal = gravityVec.dot(normal);

                let supportForce = 0;

                if (cart.attached && track && track.curve) {
                    // ON-TRACK SUPPORT: rail curvature pushes the cart into the seat.
                    const t = cart.t;
                    const dtSample = 0.02;

                    const t1 = Math.max(0, t - dtSample);
                    const t2 = Math.min(1, t + dtSample);

                    const tan1 = track.curve.getTangentAt(t1).normalize();
                    const tan2 = track.curve.getTangentAt(t2).normalize();
                    const tangentDelta = tan2.clone().sub(tan1);

                    const ds = Math.max((t2 - t1) * track.curveLength, 0.0001);
                    const signedCurvature = tangentDelta.dot(normal) / ds;

                    const speedSq = cartVel.velocity.lengthSq();
                    const centripetal = speedSq * signedCurvature;

                    supportForce = centripetal - gravityNormal;
                } else {
                    // OFF-TRACK SUPPORT: use cart speed along the seat normal as a gameplay proxy.
                    supportForce = cartVel.velocity.dot(normal);
                    //console.log("offtrack support force:", supportForce.toFixed(2))
                }

                

                const lacksSupport = supportForce <= (cart.attached ? SUPPORT_THRESHOLD : AIRBORNE_SUPPORT_THRESHOLD);

                // -------------------------
                // FOLLOW SEAT
                // -------------------------
                

                if (rotation && cartRot) {
                    rotation.rotation.copy(cartRot.rotation);
                    rotation.dirty = true;
                }

                // -------------------------
                // DETACH
                // -------------------------


                //console.log("lacks support?:", lacksSupport, "relative speed:", relativeSpeed.toFixed(2), "normalized dist:", normalizedDist.toFixed(2))



                const shouldDetach =
                    passenger.airtimeCooldown <= 0 &&
                    (
                        //relativeSpeed > MAX_RELATIVE_SPEED ||
                        //normalizedDist > MAX_RELATIVE_DISTANCE ||
                        lacksSupport
                    );

                if (shouldDetach) {
                    passenger.attached = false;
                    passenger.cartId = null;
                    passenger.airtimeCooldown = REATTACH_COOLDOWN;

                    vel.velocity.copy(cartVel.velocity);
                    vel.velocity.y += DETACH_BOOST;

                    continue;
                }

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
            for (const [cartId, cart, cartPos] of world.query2(CCart, CPosition)) {

                //if (!cart.attached) continue;

                const cartVel = world.getComponent(cartId, CVelocity)!;
                const cartRot = world.getComponent(cartId, CRotation);
                const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset);

                const d = seatPosition.distanceTo(pos.position);

                if (d < REATTACH_DIST) {

                    passenger.attached = true;
                    passenger.cartId = cartId;

                    pos.position.copy(seatPosition);
                    pos.dirty = true;

                    passenger.airtimeCooldown = AIRTIME_COOLDOWN;

                    vel.velocity.copy(cartVel.velocity);

                    if (rotation && cartRot) {
                        rotation.rotation.copy(cartRot.rotation);
                        rotation.dirty = true;
                    }

                    break;
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