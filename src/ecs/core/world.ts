import type { System } from "./system";

type ComponentClass<T> = new (...args: any[]) => T;

export class World {

    nextEntityId: number;
    entities: Set<number>;
    components: Map<ComponentClass<any>, Map<number, any>>;
    systems: System[];
    resources: Map<ComponentClass<any>, any>;

    constructor() {
        this.nextEntityId = 0;
        this.entities = new Set();
        this.components = new Map();
        this.systems = [];
        this.resources = new Map();
    }

    // --------------------------------------------------
    // ENTITIES
    // --------------------------------------------------

    createEntity(): number {
        const entityId = this.nextEntityId++;
        this.entities.add(entityId);
        return entityId;
    }

    destroyEntity(entityId: number): void {
        this.entities.delete(entityId);
        for (const componentMap of this.components.values()) {
            componentMap.delete(entityId);
        }
    }

    // --------------------------------------------------
    // COMPONENTS
    // --------------------------------------------------

    addComponent<T>(entityId: number, component: T): void {
        const type = (component as any).constructor as ComponentClass<T>;
        if (!this.components.has(type)) {
            this.components.set(type, new Map());
        }
        this.components.get(type)!.set(entityId, component);
    }

    removeComponent<T>(entityId: number, componentType: ComponentClass<T>): void {
        this.components.get(componentType)?.delete(entityId);
    }

    getComponent<T>(entityId: number, componentType: ComponentClass<T>): T | undefined {
        return this.components.get(componentType)?.get(entityId);
    }

    hasComponent<T>(entityId: number, componentType: ComponentClass<T>): boolean {
        return this.components.get(componentType)?.has(entityId) ?? false;
    }

    // --------------------------------------------------
    // RESOURCES
    // --------------------------------------------------

    addResource<T>(resource: T): void {
        const type = (resource as any).constructor as ComponentClass<T>;
        this.resources.set(type, resource);
    }

    getResource<T>(resourceType: ComponentClass<T>): T | undefined {
        return this.resources.get(resourceType);
    }

    removeResource<T>(resourceType: ComponentClass<T>): void {
        this.resources.delete(resourceType);
    }

    hasResource<T>(resourceType: ComponentClass<T>): boolean {
        return this.resources.has(resourceType);
    }

    // --------------------------------------------------
    // SYSTEMS
    // --------------------------------------------------

    addSystem(system: System): void {
        system.init?.(this);
        this.systems.push(system);
    }

    update(deltaTime: number): void {
        for (const system of this.systems) {
            system.update?.(this, deltaTime);
        }
    }

    // --------------------------------------------------
    // QUERIES (🔥 new)
    // --------------------------------------------------

    // 1 COMPONENT
    *query1<T>(componentClass: ComponentClass<T>): Iterable<[number, T]> {
        const map = this.components.get(componentClass);
        if (!map) return;

        for (const [entity, component] of map.entries()) {
            yield [entity, component];
        }
    }

    // 2 COMPONENTS (optimized)
    *query2<T1, T2>(
        c1: ComponentClass<T1>,
        c2: ComponentClass<T2>
    ): Iterable<[number, T1, T2]> {

        const map1 = this.components.get(c1);
        const map2 = this.components.get(c2);

        if (!map1 || !map2) return;

        // iterate smaller set
        const [small, other, isFirstSmall] =
            map1.size < map2.size
                ? [map1, map2, true]
                : [map2, map1, false];

        for (const [entity, compA] of small.entries()) {
            const compB = other.get(entity);
            if (!compB) continue;

            if (isFirstSmall) {
                yield [entity, compA as T1, compB as T2];
            } else {
                yield [entity, compB as T1, compA as T2];
            }
        }
    }

    *query3<T1, T2, T3>(
        c1: ComponentClass<T1>,
        c2: ComponentClass<T2>,
        c3: ComponentClass<T3>
    ): Iterable<[number, T1, T2, T3]> {

        const map1 = this.components.get(c1);
        const map2 = this.components.get(c2);
        const map3 = this.components.get(c3);

        if (!map1 || !map2 || !map3) return;

        // sort maps by size (smallest first)
        const maps = [
            { map: map1, idx: 0 },
            { map: map2, idx: 1 },
            { map: map3, idx: 2 },
        ].sort((a, b) => a.map.size - b.map.size);

        const [small, mid, large] = maps;

        for (const [entity, compA] of small.map.entries()) {
            const compB = mid.map.get(entity);
            if (!compB) continue;

            const compC = large.map.get(entity);
            if (!compC) continue;

            // restore original order (c1, c2, c3)
            const result: any[] = [];
            result[maps[0].idx] = compA;
            result[maps[1].idx] = compB;
            result[maps[2].idx] = compC;

            yield [entity, result[0], result[1], result[2]];
        }
    }


    // GENERIC (flexible but slower)
    *query<T extends any[]>(
        ...componentClasses: { [K in keyof T]: ComponentClass<T[K]> }
    ): Iterable<[number, ...T]> {

        if (componentClasses.length === 0) return;

        const maps = componentClasses
            .map(c => this.components.get(c))
            .filter(Boolean) as Map<number, any>[];

        if (maps.length !== componentClasses.length) return;

        // sort maps by size (smallest first)
        const indexedMaps = maps.map((map, idx) => ({ map, idx }))
        indexedMaps.sort((a, b) => a.map.size - b.map.size)

        const [smallest, ...rest] = indexedMaps

        for (const [entity, compA] of smallest.map.entries()) {

            const result: any[] = []
            result[smallest.idx] = compA

            let valid = true

            for (const { map, idx } of rest) {
                const comp = map.get(entity)
                if (!comp) {
                    valid = false
                    break
                }
                result[idx] = comp
            }

            if (!valid) continue

            yield [entity, ...result] as [number, ...T];
        }
    }

    getSingleton<T>(componentClass: ComponentClass<T>): T | undefined {
        const map = this.components.get(componentClass)
        if (!map || map.size === 0) return undefined

        if (map.size > 1) {
            console.warn(`getSingleton(${componentClass.name}) found multiple instances`)
        }

        // return first
        return map.values().next().value
    }
}