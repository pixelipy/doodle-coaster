import { System } from "../core/system";
import type { World } from "../core/world";
import { ESimulationState, RSimulationState } from "../resources/RSimulationState";
import { RUI } from "../resources/RUI";

export class SUI extends System {
    init(world: World): void {
        const ui = world.getResource(RUI)!;

        ui.playPauseButton = document.getElementById('play-pause-button') as HTMLButtonElement;
        ui.drawButton = document.getElementById('draw-button') as HTMLButtonElement;
        ui.eraseButton = document.getElementById('erase-button') as HTMLButtonElement;

        if (ui.playPauseButton && ui.eraseButton && ui.drawButton) {
            ui.playPauseButton.addEventListener('click', () => {
                const simulationState = world.getResource(RSimulationState)!;
                if (simulationState.state === ESimulationState.DrawingTrack) {
                    ui.playPauseButton?.getElementsByTagName('img')[0].setAttribute('src', '/icons/ui/pause.svg');
                    ui.playPauseButton?.classList.add('active');

                    ui.eraseButton?.classList.add('hide');
                    ui.drawButton?.classList.add('hide');

                    simulationState.state = ESimulationState.Playing;
                } else {
                    ui.playPauseButton?.getElementsByTagName('img')[0].setAttribute('src', '/icons/ui/play.svg');
                    ui.playPauseButton?.classList.remove('active');
                    ui.eraseButton?.classList.remove('hide');
                    ui.drawButton?.classList.remove('hide');
                    
                    simulationState.state = ESimulationState.DrawingTrack;
                }
            });
        }

        if (ui.eraseButton && ui.drawButton) {
            ui.eraseButton.addEventListener('click', () => {
                // toggle erase mode
                const simulationState = world.getResource(RSimulationState)!;
                if (simulationState.drawingMode == 'draw') {
                    ui.eraseButton?.classList.toggle('inactive');
                    ui.eraseButton?.classList.toggle('active');

                    ui.drawButton?.classList.toggle('inactive');
                    ui.drawButton?.classList.toggle('active');

                    simulationState.drawingMode = 'erase';
                }
            });

            ui.drawButton.addEventListener('click', () => {
                // toggle draw mode
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



}