import Stats from "three/examples/jsm/libs/stats.module.js";

export class RDebugger {
    stats: Stats;
    drawCallPanel: Stats.Panel;
    trianglePanel: Stats.Panel;

    constructor() {
        this.stats = new Stats();

        this.stats.dom.style.position = "absolute";
        this.stats.dom.style.left = "20px";
        this.stats.dom.style.top = "100px";

        this.drawCallPanel = this.stats.addPanel(new Stats.Panel("Draw Calls", "#0ff", "#002"));
        this.drawCallPanel.dom.style.position = "absolute";
        this.drawCallPanel.dom.style.left = "0px";
        this.drawCallPanel.dom.style.top = "50px";

        this.trianglePanel = this.stats.addPanel(new Stats.Panel("Triangles", "#0ff", "#002"));
        this.trianglePanel.dom.style.position = "absolute";
        this.trianglePanel.dom.style.left = "0px";
        this.trianglePanel.dom.style.top = "100px";

        document.body.appendChild(this.stats.dom);
    }
}