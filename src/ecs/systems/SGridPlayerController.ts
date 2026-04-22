// Player Controller
// consumes inputs, and adds velocity to the player

import { System } from "../core/system";
import { World } from "../core/world";
import { RInput } from "../resources/RInput";
import { CPlayer } from "../components/CPlayer";
import { RGrid } from "../resources/RGrid";
import { CGridMovement } from "../components/CMovementMode";
import { CPosition } from "../components/CTransform";
import { Vector3 } from "three";

export class SGridPlayerController extends System {

    constructor() {
        super();
    }

    update(world: World, _deltaTime: number): void {
        const input = world.getResource(RInput)!;
        const grid = world.getResource(RGrid)!;
        const players = world.query3(CPlayer, CGridMovement, CPosition)!;

        for (const [_entity, _player, gridMovement, position] of players) {

            if (gridMovement.isMoving) continue; // If grid movement is on the way, do not interrupt

            // keydown is a set()
            let axisX = (input.keysPressed.has('d') ? 1 : 0) - (input.keysPressed.has('a') ? 1 : 0);
            let axisZ = (input.keysPressed.has('s') ? 1 : 0) - (input.keysPressed.has('w') ? 1 : 0);

            if (axisX === 0 && axisZ === 0) continue; // No input, skip

            const gridPos = grid.worldToGrid(position.position);
            gridPos.x += axisX;
            gridPos.z += axisZ;

            //instead of just setting the position to the grid position, we want to move towards the grid position, and snap to it when we are close enough
            //like little hops

            const target = new Vector3(
                gridPos.x * grid.cellSize,
                position.position.y, // Keep the original Y position
                gridPos.z * grid.cellSize
            );

            gridMovement.isMoving = true;
            gridMovement.progress = 0;
            gridMovement.start.copy(position.position);
            gridMovement.target.copy(target);
        }
    }
}