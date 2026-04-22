export enum ESimulationState {
    Playing,
    DrawingTrack,
}



export class RSimulationState {
    // Simulation state
    state: ESimulationState = ESimulationState.DrawingTrack;

    get playing() {
        return this.state === ESimulationState.Playing;
    }
    
    get drawingTrack() {
        return this.state === ESimulationState.DrawingTrack;
    }
}