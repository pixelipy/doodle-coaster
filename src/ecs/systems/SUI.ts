import type { Camera } from "three";
import { CStation } from "../components/CStation";
import { CPosition } from "../components/CTransform";
import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { RUI } from "../resources/RUI";
import { RThree } from "../resources/RThree";
import { RWindow } from "../resources/RWindow";
import { REvents } from "../resources/REvents";
import { EVENTS } from "../core/event";
import { SUpdateSimulation } from "./SUpdateSimulation";

export class SUI extends System {
    private blurActiveUiElement() {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
    }

    private makeButtonMouseSafe(button: HTMLButtonElement | null) {
        if (!button) return;

        button.tabIndex = -1;

        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });

        button.addEventListener('click', () => {
            this.blurActiveUiElement();
        });
    }

    init(world: World): void {
        const ui = world.getResource(RUI)!;

        ui.playPauseButton = document.getElementById('play-pause-button') as HTMLButtonElement;
        ui.drawButton = document.getElementById('draw-button') as HTMLButtonElement;
        ui.eraseButton = document.getElementById('erase-button') as HTMLButtonElement;

        ui.offscreenStartIcon.icon = document.getElementById('offscreen-start-icon') as HTMLImageElement;
        ui.offscreenEndIcon.icon = document.getElementById('offscreen-end-icon') as HTMLImageElement;

        this.makeButtonMouseSafe(ui.playPauseButton);
        this.makeButtonMouseSafe(ui.drawButton);
        this.makeButtonMouseSafe(ui.eraseButton);

        if (ui.playPauseButton && ui.eraseButton && ui.drawButton) {
            ui.playPauseButton.addEventListener('click', () => {
                SUpdateSimulation.playPause(world);
            });
        }

        if (ui.eraseButton && ui.drawButton) {
            ui.eraseButton.addEventListener('click', () => {
                // toggle erase mode
                SUpdateSimulation.drawModeChange(world, "erase");
            });

            ui.drawButton.addEventListener('click', () => {
                // toggle draw mode
                SUpdateSimulation.drawModeChange(world, "draw");
                const simulationState = world.getResource(RSimulationState)!;
                if (simulationState.drawingMode == 'erase') {
                    ui.eraseButton?.classList.toggle('inactive');
                    ui.eraseButton?.classList.toggle('active');

                    ui.drawButton?.classList.toggle('inactive');
                    ui.drawButton?.classList.toggle('active');

                    simulationState.drawingMode = 'draw';
                }
            });
        }
    }

    isOffscreen(stationId: number, camera: Camera, world: World): boolean {
        const pos = world.getComponent(stationId, CPosition);

        const ndc = pos?.position.clone().project(camera);

        return !!ndc && (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1 || ndc.z < 0);
    }

    updateIndicator(
        icon: HTMLImageElement,
        stationId: number,
        camera: Camera,
        world: World,
        window: RWindow,
    ) {
        const pos = world.getComponent(stationId, CPosition)!;
        const worldPos = pos.position;

        const ndc = worldPos.clone().project(camera);

        const isOffscreen =
            !!ndc &&
            (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1 || ndc.z < 0);

        if (!isOffscreen) {
            icon.classList.add('hide')
            return;
        }
        else {
            icon.classList.remove('hide');
        }


        // screen position
        const x = (ndc.x * 0.5 + 0.5) * window.width;
        const y = (1 - (ndc.y * 0.5 + 0.5)) * window.height;

        const margin = 40;

        // direction from screen center
        const centerX = window.width / 2;
        const centerY = window.height / 2;

        let dx = x - centerX;
        let dy = y - centerY;

        const length = Math.sqrt(dx * dx + dy * dy) || 1;

        const dirX = dx / length;
        const dirY = dy / length;

        // project a world radius to screen space
        const radius = 0.8; // adjust based on your station size

        const edgeWorld = worldPos.clone().add({ x: radius, y: 0, z: 0 } as any);
        const edgeNdc = edgeWorld.project(camera);

        const radiusNdc = Math.abs(edgeNdc.x - ndc.x);
        const radiusPx = radiusNdc * 0.5 * window.width;

        // offset so arrow points to circle edge instead of center
        const offsetX = x - dirX * radiusPx;
        const offsetY = y - dirY * radiusPx;

        // clamp to screen
        const clampedX = Math.min(
            Math.max(offsetX, margin),
            window.width - margin
        );

        const clampedY = Math.min(
            Math.max(offsetY, margin),
            window.height - margin
        );

        icon.style.left = `${clampedX}px`;
        icon.style.top = `${clampedY}px`;

        // rotation uses real direction
        const angle = Math.atan2(dy, dx);

        icon.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    }


    update(world: World, _deltaTime: number): void {
        const stations = world.query1(CStation);
        const ui = world.getResource(RUI)!;
        const camera = world.getResource(RThree)!.camera;
        const window = world.getResource(RWindow)!;
        const events = world.getResource(REvents)!;
        const simulationState = world.getResource(RSimulationState)!;

        //listen to world change events!
        for (const event of events.current) {
            if (event.type === EVENTS.SIMULATION_STATE_CHANGED) {
                //when playing, hide indicators.
                if (!ui.offscreenStartIcon.icon || !ui.offscreenEndIcon.icon) break;

                if (event.data === ESimulationState.Playing) {
                    this.blurActiveUiElement();
                    ui.offscreenStartIcon.icon.classList.add('hide');
                    ui.offscreenEndIcon.icon.classList.add('hide');
                } else {
                    ui.offscreenStartIcon.icon.classList.remove('hide');
                    ui.offscreenEndIcon.icon.classList.remove('hide');
                }

                if (simulationState.state === ESimulationState.Playing) {
                    ui.playPauseButton?.getElementsByTagName('img')[0].setAttribute('src', '/icons/ui/pause.svg');
                    ui.playPauseButton?.classList.add('active');

                    ui.eraseButton?.classList.add('hide');
                    ui.drawButton?.classList.add('hide');
                } else {
                    ui.playPauseButton?.getElementsByTagName('img')[0].setAttribute('src', '/icons/ui/play.svg');
                    ui.playPauseButton?.classList.remove('active');
                    ui.eraseButton?.classList.remove('hide');
                    ui.drawButton?.classList.remove('hide');
                }
            }
            if (event.type === EVENTS.DRAW_MODE_CHANGED) {
                const simulationState = world.getResource(RSimulationState)!;

                if (simulationState.drawingMode == 'draw') {
                    ui.eraseButton?.classList.add('inactive');
                    ui.eraseButton?.classList.remove('active');

                    ui.drawButton?.classList.remove('inactive');
                    ui.drawButton?.classList.add('active');
                }else if (simulationState.drawingMode == 'erase') {
                    ui.eraseButton?.classList.remove('inactive');
                    ui.eraseButton?.classList.add('active');

                    ui.drawButton?.classList.add('inactive');
                    ui.drawButton?.classList.remove('active');
                }
            }
        }

        if (simulationState.state === ESimulationState.Playing) return;

        for (const [_entityId, station] of stations) {
            //assign icons to station ids
            if (ui.offscreenEndIcon.stationId == null && station.kind == 'goal') {
                ui.offscreenEndIcon.stationId = _entityId;
            }

            if (ui.offscreenStartIcon.stationId == null && station.kind == 'start') {
                ui.offscreenStartIcon.stationId = _entityId;
            }

            //using station ids, see if they are offscreen, and if so, show icons. If not, hide icons.
            if (ui.offscreenStartIcon.stationId != null) {
                this.updateIndicator(ui.offscreenStartIcon.icon!, ui.offscreenStartIcon.stationId, camera, world, window);
            }

            if (ui.offscreenEndIcon.stationId != null) {
                this.updateIndicator(ui.offscreenEndIcon.icon!, ui.offscreenEndIcon.stationId, camera, world, window);
            }
        }
    }
}
