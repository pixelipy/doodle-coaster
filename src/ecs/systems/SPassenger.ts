import { Euler, Vector3 } from "three";
import { CCart } from "../components/CCart";
import { CPassenger } from "../components/CPassenger";
import { CPosition, CRotation } from "../components/CTransform";
import { CVelocity } from "../components/CVelocity";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { CTrack } from "../components/CTrack";

const GRAVITY = 4;
const REATTACH_DIST = 0.2;
const AIRTIME_COOLDOWN = 0.1;

const DETACH_SPEED_THRESHOLD = 2.5;
const DETACH_SLOPE_THRESHOLD = 0.35;
const AIR_SPIN_SPEED_X = 0;
const AIR_SPIN_SPEED_Z = -7;
const seatWorldOffset = new Vector3();
const reattachSeatPosition = new Vector3();
const seatRotation = new Euler();

export class SPassenger extends System {

    update(world: World, dt: number): void {

        const sim = world.getResource(RSimulationState)!;
        if (sim.state !== ESimulationState.Playing) return;

        const passengers = world.query3(CPosition, CVelocity, CPassenger);

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
                const track = (cart && cart.trackId !== null && cart.trackId !== undefined)
                    ? world.getComponent(cart.trackId, CTrack)
                    : null;

                if (!cart || !cartPos || !cartVel) {
                    passenger.attached = false;
                    passenger.cartId = null;
                    continue;
                }

                if (!track || !track.curve) {
                    passenger.attached = false;
                    passenger.cartId = null;
                    vel.velocity.copy(cartVel.velocity);
                    continue;
                } else {

                    // follow cart
                    const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset);
                    pos.position.copy(seatPosition);
                    pos.dirty = true;
                    passenger.airtimeTimer = 0;

                    if (rotation && cartRot) {
                        rotation.rotation.copy(cartRot.rotation);
                        rotation.dirty = true;
                    }

                    const tangent = track.curve.getTangentAt(cart.t).normalize();

                    const goingDown = cartVel.velocity.y < -DETACH_SPEED_THRESHOLD;
                    const trackGoingDown = tangent.y < -DETACH_SLOPE_THRESHOLD;

                    const shouldDetach =
                        passenger.airtimeCooldown <= 0 &&
                        goingDown &&
                        trackGoingDown;

                    if (shouldDetach) {

                        // 🔴 DETACH
                        passenger.attached = false;
                        passenger.cartId = null;

                        // Keep the cart's actual world velocity at the moment of release.
                        vel.velocity.copy(cartVel.velocity);

                        // 🔴 CRITICAL: STOP HERE (do not run free physics this frame)
                        continue;
                    } else {
                        continue;
                    }
                }
            }

            // -------------------------
            // FREE PHYSICS
            // -------------------------
            pos.position.addScaledVector(vel.velocity, dt);
            vel.velocity.y -= GRAVITY * dt;
            pos.dirty = true;
            passenger.airtimeTimer += dt;

            if (rotation) {
                rotation.rotation.x += AIR_SPIN_SPEED_X * dt;
                rotation.rotation.z += AIR_SPIN_SPEED_Z * dt;
                rotation.dirty = true;
            }

            // -------------------------
            // REATTACH
            // -------------------------
            for (const [cartId, cart, cartPos] of world.query2(CCart, CPosition)) {

                if (!cart.attached) continue;

                const cartRot = world.getComponent(cartId, CRotation);
                const seatPosition = getSeatPosition(cartPos.position, cartRot, passenger.offset);
                const d = seatPosition.distanceTo(pos.position);

                if (d < REATTACH_DIST) {

                    passenger.attached = true;
                    passenger.cartId = cartId;

                    pos.position.copy(seatPosition);
                    pos.dirty = true;
                    passenger.airtimeCooldown = AIRTIME_COOLDOWN;
                    passenger.airtimeTimer = 0;

                    const cartRot = world.getComponent(cartId, CRotation);
                    if (rotation && cartRot) {
                        rotation.rotation.copy(cartRot.rotation);
                        rotation.dirty = true;
                    }

                    vel.velocity.set(0, 0, 0);

                    break;
                }
            }
        }
    }
}

function getSeatPosition(cartPosition: Vector3, cartRotation: CRotation | undefined, seatOffset: Vector3): Vector3 {
    seatWorldOffset.copy(seatOffset);

    if (cartRotation) {
        seatRotation.set(
            cartRotation.rotation.x,
            cartRotation.rotation.y,
            cartRotation.rotation.z,
        );
        seatWorldOffset.applyEuler(seatRotation);
    }

    return reattachSeatPosition.copy(cartPosition).add(seatWorldOffset);
}