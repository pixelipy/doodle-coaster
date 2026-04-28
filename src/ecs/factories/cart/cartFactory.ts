import { Mesh, Object3D, Vector3 } from "three";
import type { World } from "../../core/world";
import { RThree } from "../../resources/RThree";
import { CCart } from "../../components/CCart";
import { CPosition, CRotation } from "../../components/CTransform";
import { CVelocity } from "../../components/CVelocity";
import { CObject3D } from "../../components/CObject3D";
import { RAssetManager } from "../../resources/RAssetManager";
import { loadCart } from "../../utils/cartLoader";
import { FPassenger } from "../passengerFactory";
import { GradientUnlitMaterial } from "../../../materials/GradientUnlitMaterial";

export async function FCart(world: World, spawnConfig: { position?: Vector3, rotationZ?: number } = {}): Promise<number> {

    const three = world.getResource(RThree)!;
    const assets = world.getResource(RAssetManager)!;

    const cartDefinition = await loadCart('/carts/carts.json', 'cart-classic');

    const mesh = assets.getModel(cartDefinition.id);
    mesh.scale.set(cartDefinition.scale, cartDefinition.scale, cartDefinition.scale);

    const passengerSlots: Object3D[] = []

    mesh.traverse((child) => {
        if (child instanceof Mesh) {
            cartDefinition.parts.forEach(part => {
                if (child.isMesh && child.name === part.id) {
                    child.material = new GradientUnlitMaterial(
                        {
                            map: assets.getTexture('gradientMap'),
                            color: part.colors[part.currentActiveColor] || "#FFFFFF",
                        }
                    );
                }
            })
        }
        else if (child.name.includes("slot")) {
            passengerSlots.push(child);
        }
    });

    const scene = three.scene;

    const cartParent = new Object3D()
    mesh.position.y = 0.1;
    cartParent.add(mesh);
    scene.add(cartParent);
    cartParent.updateMatrixWorld(true);

    const passengers = passengerSlots.map((slot) => {
        const position = new Vector3();
        slot.getWorldPosition(position);
        return cartParent.worldToLocal(position);
    });

    const cartId = world.createEntity();
    const cart = world.addComponent(cartId, new CCart());
    const cartPos = world.addComponent(cartId, new CPosition());
    world.addComponent(cartId, new CVelocity());
    const cartRotation = world.addComponent(cartId, new CRotation());
    const cartObj = world.addComponent(cartId, new CObject3D(cartParent, mesh));

    //spawn at location
    cartPos.position.copy(spawnConfig.position ?? new Vector3(0, 0, 0));
    cartPos.previousPosition.copy(cartPos.position);
    cart.spawnPosition.copy(cartPos.position);

    cartRotation.rotation.set(0, 0, spawnConfig.rotationZ ?? 0);
    cartRotation.previousRotation.copy(cartRotation.rotation);
    cart.spawnRotation.copy(cartRotation.rotation);

    // spawn passengers

    for (const position of passengers) {
        await FPassenger(world, cartObj.object3D, position, cartDefinition.passengerPose);
    }

    return cartId;
}
