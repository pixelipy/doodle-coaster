export type LevelVectorDefinition = {
    x: number
    y: number
    z?: number
}

export type LevelStationDefinition = {
    id: string
    kind: "start" | "goal"
    position: LevelVectorDefinition
    direction: LevelVectorDefinition
    stubLength: number
    boostSpeed: number
    radius: number
}

export type LevelObstacleDefinition = {
    id: string
    position: LevelVectorDefinition
    radius: number
}

export type LevelDefinition = {
    id: string
    cartSpawnStationId: string
    stations: LevelStationDefinition[]
    obstacles: LevelObstacleDefinition[]
}

export class RLevel {
    currentLevelId: string | null = null
    definition: LevelDefinition | null = null
    completed: boolean = false
    cartId: number | null = null

    stationEntities = new Map<string, number>()
    stationStubTracks = new Map<string, number>()
    obstacleEntities = new Map<string, number>()

    reset(definition: LevelDefinition) {
        this.currentLevelId = definition.id
        this.definition = definition
        this.completed = false
        this.cartId = null
        this.stationEntities.clear()
        this.stationStubTracks.clear()
        this.obstacleEntities.clear()
    }
}
