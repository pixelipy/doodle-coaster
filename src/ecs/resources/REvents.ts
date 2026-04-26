import type { GameEvent } from "../core/event";

export class REvents {
    current: GameEvent[] = [];
    next: GameEvent[] = [];

    emit(event: GameEvent) {
        this.next.push(event);
    }

    swap() {
        this.current = this.next;
        this.next = [];
    }
}