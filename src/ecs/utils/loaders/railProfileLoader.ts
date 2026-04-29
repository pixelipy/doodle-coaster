import type { RailProfileCollectionDefinition } from "../../resources/RTrackProfiles";

export async function loadRailProfileCollection(path: string): Promise<RailProfileCollectionDefinition> {
    const response = await fetch(path)
    if (!response.ok) {
        throw new Error(`Failed to load rail profiles from ${path}`)
    }

    return await response.json() as RailProfileCollectionDefinition
}
