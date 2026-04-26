import { CCart } from "../components/CCart";
import { CPosition } from "../components/CTransform";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { CCamera } from "../components/CCamera";
import { RInput } from "../resources/RInput";
import { RTime } from "../resources/RTime";
import { RSettings } from "../resources/RSettings";
import { RWindow } from "../resources/RWindow";

export class SCameraController extends System {
    update(world: World, dt: number): void {
        const input = world.getResource(RInput)!;
        const time = world.getResource(RTime)!;
        const settings = world.getResource(RSettings)!;
        const window = world.getResource(RWindow)!;
        const simulationState = world.getResource(RSimulationState)!;

        let cameraComp: CCamera | null = null;
        let cameraPosition: CPosition | null = null;

        for (const [_entityId, foundCameraComp, foundCameraPosition] of world.query2(CCamera, CPosition)) {
            cameraComp = foundCameraComp;
            cameraPosition = foundCameraPosition;
            break;
        }

        if (!cameraComp || !cameraPosition) return;


        const cart = world.getComponent(cameraComp.targetId, CCart);
        const cartPos = world.getComponent(cameraComp.targetId, CPosition)!;

        // target position is cart position. After will be the average cart position.

        let camera_z_draw = settings.camera.DRAWING_Z_VALUE_DESKTOP;
        let camera_z_default = settings.camera.DEFAULT_Z_VALUE_DESKTOP;
        let camera_pan_speed = settings.camera.PAN_SPEED;
        let camera_zoom_speed = settings.camera.ZOOM_SPEED;

        if (window.width < 600) {
            camera_z_draw = settings.camera.DRAWING_Z_VALUE_MOBILE;
            camera_z_default = settings.camera.DEFAULT_Z_VALUE_MOBILE;
            camera_pan_speed = settings.camera.MOBILE_PAN_SPEED;
            camera_zoom_speed = settings.camera.MOBILE_ZOOM_SPEED;
        }


        if (simulationState.state == ESimulationState.DrawingTrack) {
            //return to default position, and allow panning.
            //add offset later.

            cameraComp.zoom = clamp(camera_z_draw + cameraComp.panOffset.z, cameraComp.min_zoom, cameraComp.max_zoom);
            cameraComp.panOffset.z = cameraComp.zoom - camera_z_draw;


            const targetPos = cartPos.previousPosition.clone().lerp(cartPos.position, time.interpolationAlpha);
            targetPos.z = cameraComp.zoom; // set z to zoom level for drawing mode

            const currentPos = cameraPosition.position.clone();
            const lerpFactor = 1 - Math.pow(0.005, dt); // smooth but frame-rate independent
            const hasTouchCameraInput = input.touches.size === 2;
            const hasPanInput = input.mmbDown || hasTouchCameraInput;
            const hasZoomInput = input.zoomDelta !== 0;
            const isActivelyControllingCamera = hasPanInput || hasZoomInput;

            if (hasPanInput) {
                cameraComp.panOffset.x -= input.panDelta.x * camera_pan_speed;
                cameraComp.panOffset.y += input.panDelta.y * camera_pan_speed;
            }

            if (hasZoomInput) {
                cameraComp.panOffset.z += input.zoomDelta * camera_zoom_speed;
                cameraComp.zoom = clamp(camera_z_draw + cameraComp.panOffset.z, cameraComp.min_zoom, cameraComp.max_zoom);
                cameraComp.panOffset.z = cameraComp.zoom - camera_z_draw;
            }

            targetPos.x += cameraComp.panOffset.x;
            targetPos.y += cameraComp.panOffset.y;
            targetPos.z = cameraComp.zoom;

            if (isActivelyControllingCamera) {
                currentPos.lerp(targetPos, Math.min(1, 20 * dt)); // snap to target faster when panning for better responsiveness
            } else {
                currentPos.lerp(targetPos, lerpFactor);
            }

            cameraPosition.previousPosition.copy(currentPos);
            cameraPosition.position.copy(currentPos);
            cameraPosition.dirty = true;
            return;
        }

        cameraComp.panOffset.set(0, 0, 0); // reset pan when not in drawing mode


        if (cart) {
            const targetPos = cartPos.previousPosition.clone().lerp(cartPos.position, time.interpolationAlpha);

            targetPos.z += camera_z_default; // offset back so we can see the cart

            // smooth follow
            const currentPos = cameraPosition.position.clone();
            const lerpFactor = 1 - Math.pow(0.001, dt); // smooth but frame-rate independent
            currentPos.lerp(targetPos, lerpFactor);
            cameraPosition.previousPosition.copy(currentPos);
            cameraPosition.position.copy(currentPos);
            cameraPosition.dirty = true;
        }
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}
