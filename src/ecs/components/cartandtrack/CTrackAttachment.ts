import { Component } from "../../core/component"

export class CTrackAttachment extends Component {
    attached: boolean = false
    trackId: number | null = null
    lastTrackId: number | null = null
    reattachCooldown: number = 0
    t: number = 0
    distanceAlongTrack: number = 0
}
