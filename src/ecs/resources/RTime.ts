export class RTime {
    deltaTime: number = 0
    elapsedTime: number = 0
    fixedTimestep: number = 0.02
    accumulator: number = 0
    pendingFixedSteps: number = 0
    interpolationAlpha: number = 0
}