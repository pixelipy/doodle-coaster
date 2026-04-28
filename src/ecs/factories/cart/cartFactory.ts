import {  Mesh, Object3D } from "three";
import type { World } from "../../core/world";
import { RThree } from "../../resources/RThree";
import { CCart } from "../../components/CCart";
import { CPosition, CRotation } from "../../components/CTransform";
import { CVelocity } from "../../components/CVelocity";
import { CObject3D } from "../../components/CObject3D";
import { RAssetManager } from "../../resources/RAssetManager";
import { GradientLitMaterial } from "../../../materials/GradientLitMaterial";

export function FCart(world: World): number {

    const three = world.getResource(RThree)!;
    const assets = world.getResource(RAssetManager)!;
    const mesh = assets.getModel('cart-classic');
    mesh.scale.set(0.14, 0.14, 0.14);
    mesh.traverse((child) => {
        if (child instanceof Mesh) {
            if (child.name == "cart_classic_body") {
                child.material = new GradientLitMaterial(
                    {
                        map: assets.getTexture('gradientMap'),
                        color: 0x5645FF,
                        //darkColor: 0x4D1900
                        //color: 0x5645FF,
                    }
                );
                
            }
            else if (child.name == "cart_classic_seats") {
                child.material = new GradientLitMaterial(
                    {
                        map: assets.getTexture('gradientMap'),
                        //lightColor: 0xF27930,
                        //darkColor: 0xBB280D,
                        color: 0x595959,
                    }
                );
            }
             else if (child.name == "cart_classic_grays") {
                child.material = new GradientLitMaterial(
                    {
                        map: assets.getTexture('gradientMap'),
                        color: 0xACACAC,
                    }
                );
            }
        }
    });



    const scene = three.scene;

    const cartParent = new Object3D()
    mesh.position.y = 0.1;
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
