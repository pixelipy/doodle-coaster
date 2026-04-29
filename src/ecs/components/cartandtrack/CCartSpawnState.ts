import { Vector3 } from "three"
import { Component } from "../../core/component"

export class CCartSpawnState extends Component {
    spawnPosition: Vector3 = new Vector3()
    spawnRotation: Vector3 = new Vector3()
}
