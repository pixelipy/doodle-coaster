export enum ESimulationState {
    Playing,
    DrawingTrack,
}



export class RSimulationState {
    // Simulation state
    state: ESimulationState = ESimulationState.DrawingTrack;
    drawingMode: "draw" | "erase" = "draw";
}