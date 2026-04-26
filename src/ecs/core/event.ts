export class GameEvent {
    type: string = "";
    data: any;

    constructor(type: string, data: any = {}) {
        this.type = type;
        this.data = data;
    }
}

export const EVENTS = {
    SIMULATION_STATE_CHANGED: 'simulationStateChanged',
    DRAW_MODE_CHANGED: 'drawModeChanged',
}