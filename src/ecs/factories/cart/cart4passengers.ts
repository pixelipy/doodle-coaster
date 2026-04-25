import { Vector3 } from "three";
import { CCart } from "../../components/CCart";
import { CPosition, CRotation } from "../../components/CTransform";
import { FCart } from "./cartFactory";
import { FPassenger } from "../passengerFactory";
import { CPassenger } from "../../components/CPassenger";
import { CVelocity } from "../../components/CVelocity";
import type { World } from "../../core/world";
import { RRng } from "../../resources/RRng";

export const FCart4Passengers = (
    world: World,
    spawnConfig: { position?: Vector3, rotationZ?: number } = {}
): number => {
    const cartId = FCart(world);
    const rng = world.getResource(RRng)!;

    const cartPos = world.getComponent(cartId, CPosition)!;
    cartPos.position.copy(spawnConfig.position ?? new Vector3(0, 0, 0));
    cartPos.previousPosition.copy(cartPos.position);
    const cart = world.getComponent(cartId, CCart)!;
    cart.spawnPosition.copy(cartPos.position);

    const cartRotation = world.getComponent(cartId, CRotation)!;
    cartRotation.rotation.set(0, 0, spawnConfig.rotationZ ?? 0);
    cartRotation.previousRotation.copy(cartRotation.rotation);
    cart.spawnRotation.copy(cartRotation.rotation);

    // number of passengers
    const count = 4 // try 4 (2x2), 9 (3x3), etc.
    const size = Math.ceil(Math.sqrt(count)) // grid size

    const spacing = 0.12
    const height = 0.15

    for (let i = 0; i < count; i++) {

        const x = i % size
        const z = Math.floor(i / size)

        // center the grid
        const offsetX = (x - (size - 1) / 2) * spacing
        const offsetZ = (z - (size - 1) / 2) * spacing

        const offset = new Vector3(offsetX, height, offsetZ)

        // 🔴 IMPORTANT: spawn already at correct position
        const spawnPos = cartPos.position.clone().add(offset)

        const p = FPassenger(world, spawnPos)
        const passenger = world.getComponent(p, CPassenger)!

        passenger.offset.copy(offset)
        passenger.spawnPosition.copy(spawnPos)
        passenger.attached = true
        passenger.cartId = cartId
        passenger.homeCartId = cartId
        passenger.airtimeCooldown = 0.3
        passenger.weight = 1 + (rng.nextFloat() - 0.5) * 0.05;

        const vel = world.getComponent(p, CVelocity)!
        const cartVel = world.getComponent(cartId, CVelocity)!

        vel.velocity.copy(cartVel.velocity)
    }

    return cartId;
}
