import { IInputs, IOutputs } from "./generated/ManifestTypes";
import App from "./src/App";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

export class ForecastingVisual implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private root: Root;
    private notifyOutputChanged: () => void;

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    /**
     * Used to initialize the control instance.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.container = container;
        this.notifyOutputChanged = notifyOutputChanged;
        // Use React 18/19 createRoot
        this.root = createRoot(this.container);
    }

    /**
     * Called when any value in the property bag has changed.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        console.log("PCF Component React version:", React.version);
        // Render the App component into the root
        this.root.render(React.createElement(App));
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     */
    public getOutputs(): IOutputs {
        return { };
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     */
    public destroy(): void {
        if (this.root) {
            this.root.unmount();
        }
    }
}
