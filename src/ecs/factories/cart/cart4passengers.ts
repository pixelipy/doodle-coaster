import { Vector3 } from "three";
import { CCart } from "../../components/CCart";
import { CPosition, CRotation } from "../../components/CTransform";
import { FCart } from "./cartFactory";
import { FPassenger } from "../passengerFactory";
import { CPassenger } from "../../components/CPassenger";
import { CVelocity } from "../../components/CVelocity";
import type { World } from "../../core/world";
import { RRng } from "../../resources/RRng";

export const FCart4Passengers = async (
    world: World,
    spawnConfig: { position?: Vector3, rotationZ?: number } = {}
): Promise<number> => {
    const cartId = await FCart(world);
    const rng = world.getResource(RRng)!;

    

    

    return cartId;
}
