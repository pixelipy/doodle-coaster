import { Vector3 } from "three";
import { CCart } from "../components/CCart";
import { CPosition } from "../components/CTransform";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { CCamera } from "../components/CCamera";
import { RInput } from "../resources/RInput";
import { RTime } from "../resources/RTime";

export class SCameraController extends System {
    update(world: World, dt: number): void {
        const input = world.getResource(RInput)!;
        const time = world.getResource(RTime)!;
        const cameraComp = world.getSingleton(CCamera)!;
        const camera = cameraComp.cameraObject;

        const simulationState = world.getResource(RSimulationState)!;

        // target position is cart position. After will be the average cart position.

        if (simulationState.state == ESimulationState.DrawingTrack) {
            //return to default position, and allow panning.
            //add offset later.

            const targetPos = new Vector3(0, 0, 5);
            const currentPos = camera.position.clone();
            const lerpFactor = 1 - Math.pow(0.005, dt); // smooth but frame-rate independent
            let smoothing = true;

            //add panning
            if (input.mmbDown) {
                cameraComp.panOffset.x -= input.mouseDelta.x * cameraComp.panningSpeed * dt;
                cameraComp.panOffset.y += input.mouseDelta.y * cameraComp.panningSpeed * dt;
                smoothing = false; // disable smoothing while actively panning for more responsive feel
            }

            targetPos.add(cameraComp.panOffset);

            if (!smoothing) {
                currentPos.lerp(targetPos, 20 * dt); // snap to target faster when panning for better responsiveness
            } else {
                currentPos.lerp(targetPos, lerpFactor);
            }


            currentPos.lerp(targetPos, lerpFactor);
            camera.position.copy(currentPos);
            return;
        }

        cameraComp.panOffset.set(0, 0, 0); // reset pan when not in drawing mode
        const cart = world.getComponent(cameraComp.targetId, CCart);

        if (cart) {
            const pos = world.getComponent(cameraComp.targetId, CPosition)!;
            const targetPos = pos.previousPosition.clone().lerp(pos.position, time.interpolationAlpha);
            targetPos.z += 5; // offset back so we can see the cart

            // smooth follow
            const currentPos = camera.position.clone();
            const lerpFactor = 1 - Math.pow(0.001, dt); // smooth but frame-rate independent
            currentPos.lerp(targetPos, lerpFactor);
            camera.position.copy(currentPos);
        }
    }
}