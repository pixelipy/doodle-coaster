export type RailDefinition = {
    lateralOffset: number
    verticalOffset: number
    radius: number
    radialSegments: number
    materialKey: string
}

export type RailAnchorDefinition = {
    spacing: number
}

export type RailCenterPieceDefinition = {
    modelKey: string | null
    scale: number
    orientationMode: "tangent"
}

export type RailProfileDefinition = {
    id: string
    name: string
    visualSampleSpacing: number
    tubeSegmentLength: number
    rails: RailDefinition[]
    anchors: RailAnchorDefinition
    centerPiece?: RailCenterPieceDefinition
}

export type RailProfileCollectionDefinition = {
    activeProfileId: string
    profiles: RailProfileDefinition[]
}

export class RTrackProfiles {
    profiles = new Map<string, RailProfileDefinition>()
    activeProfileId: string | null = null
    version = 0

    loadCollection(collection: RailProfileCollectionDefinition) {
        this.profiles.clear()

        for (const profile of collection.profiles) {
            this.profiles.set(profile.id, profile)
        }

        this.activeProfileId = collection.activeProfileId
        this.version++
    }

    getActiveProfile() {
        if (!this.activeProfileId) return null
        return this.profiles.get(this.activeProfileId) ?? null
    }

    setActiveProfileId(profileId: string) {
        if (!this.profiles.has(profileId)) {
            throw new Error(`Unknown rail profile: ${profileId}`)
        }

        if (this.activeProfileId === profileId) {
            return
        }

        this.activeProfileId = profileId
        this.version++
    }
}
