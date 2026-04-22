import { BoxGeometry, Mesh, MeshBasicMaterial, MeshNormalMaterial, Object3D } from "three";
import { CCart } from "../components/CCart";
import type { World } from "../core/world";
import { RThree } from "../resources/RThree";
import { CObject3D } from "../components/CObject3D";
import { CVelocity } from "../components/CVelocity";
import { CPosition, CRotation } from "../components/CTransform";

export function FCart(world: World): number {

    const three = world.getResource(RThree)!;
    const scene = three.scene;

    const cartParent = new Object3D()
    const mesh = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshNormalMaterial());
    cartParent.add(mesh);
    scene.add(cartParent);

    const cartId = world.createEntity();
    world.addComponent(cartId, new CCart());
    world.addComponent(cartId, new CPosition());
    world.addComponent(cartId, new CVelocity());
    world.addComponent(cartId, new CRotation());
    world.addComponent(cartId, new CObject3D(cartParent, mesh));

    return cartId;
}