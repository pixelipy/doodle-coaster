import {
    BufferGeometry,
    Mesh,
    Vector3,
    type Material,
} from "three";
import { PipeMaterial } from "../../materials/PipeMaterial";
import { RAssetManager } from "./RAssetManager";
import type { RailProfileDefinition } from "./RTrackProfiles";
import { GradientUnlitMaterial } from "../../materials/GradientUnlitMaterial";

type CenterPieceAssets = {
    geometry: BufferGeometry
    material: Material
    castShadow: boolean
    receiveShadow: boolean
}

export class RTrackVisualCache {
    private activeProfileId: string | null = null
    private activeProfileVersion: number | null = null
    private railMaterials = new Map<string, Material>()
    private centerPieceAssets: CenterPieceAssets | null = null

    ensureActiveProfileAssets(
        profileVersion: number,
        profile: RailProfileDefinition,
        assetManager: RAssetManager
    ) {
        if (
            this.activeProfileId === profile.id &&
            this.activeProfileVersion === profileVersion
        ) {
            return
        }

        this.dispose()
        this.activeProfileId = profile.id
        this.activeProfileVersion = profileVersion

        const uniqueRailMaterialKeys = new Set(profile.rails.map(rail => rail.materialKey))
        for (const materialKey of uniqueRailMaterialKeys) {
            this.railMaterials.set(materialKey, createRailMaterial(materialKey))
        }

        this.centerPieceAssets = buildCenterPieceAssets(profile, assetManager)
    }

    getRailMaterial(materialKey: string): Material {
        const material = this.railMaterials.get(materialKey)
        if (material) return material

        const fallback = createRailMaterial(materialKey)
        this.railMaterials.set(materialKey, fallback)
        return fallback
    }

    getCenterPieceAssets() {
        return this.centerPieceAssets
    }

    dispose() {
        for (const material of this.railMaterials.values()) {
            material.dispose()
        }
        this.railMaterials.clear()

        if (this.centerPieceAssets) {
            this.centerPieceAssets.geometry.dispose()
            this.centerPieceAssets.material.dispose()
            this.centerPieceAssets = null
        }

        this.activeProfileId = null
        this.activeProfileVersion = null
    }
}

function buildCenterPieceAssets(
    profile: RailProfileDefinition,
    assetManager: RAssetManager | undefined
) {
    if (!assetManager || !profile.centerPiece?.modelKey) return null

    const sourceMesh = getCenterPieceSourceMesh(assetManager, profile.centerPiece.modelKey)
    if (!sourceMesh) return null

    const geometry = sourceMesh.geometry.clone()
    geometry.applyMatrix4(sourceMesh.matrixWorld)

    return {
        geometry,
        material: new GradientUnlitMaterial({
            map: assetManager.getTexture("gradientMap"),
            color: profile.centerPiece.color ?? "#ffffff"
        }),
        castShadow: sourceMesh.castShadow,
        receiveShadow: sourceMesh.receiveShadow,
    }
}

function getCenterPieceSourceMesh(assetManager: RAssetManager, modelKey: string) {
    if (!assetManager.hasModel(modelKey)) {
        console.warn(`[RTrackVisualCache] Center piece model is not loaded: ${modelKey}`)
        return null
    }

    const model = assetManager.getModel(modelKey)
    model.updateMatrixWorld(true)

    const meshes: Mesh[] = []
    model.traverse(object => {
        if (object instanceof Mesh) {
            meshes.push(object)
        }
    })

    if (meshes.length !== 1) {
        console.warn(`[RTrackVisualCache] Center piece model must contain exactly one mesh: ${modelKey}`)
        return null
    }

    return meshes[0]
}

function createRailMaterial(materialKey: string) {
    return new PipeMaterial({
        lightDir: new Vector3(0.5, 1, 0.5).normalize(),
        lightColor: materialKey,
        shininess: 16
    })
}

