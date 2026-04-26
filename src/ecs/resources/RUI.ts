export class RUI {
    playPauseButton: HTMLButtonElement | null = null;
    drawButton: HTMLButtonElement | null = null;
    eraseButton: HTMLButtonElement | null = null;

    offscreenStartIcon: {
        icon: HTMLImageElement | null;
        stationId: number | null;
    } = {
            icon: null,
            stationId: null,
        };

    offscreenEndIcon: {
        icon: HTMLImageElement | null;
        stationId: number | null;
    } = {
            icon: null,
            stationId: null,
        };
}