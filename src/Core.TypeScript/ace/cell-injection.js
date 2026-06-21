import { ZetaCell } from "../file-type-plugin/cell";
import { CodecRegistry } from "../file-type-plugin/codecs";
export class AceCellContainer {
    cell = null;
    plugins = new Map();
    /**
     * DI-injects a Zeta cell into the Ace container.
     */
    injectCell(cell) {
        this.cell = cell;
    }
    /**
     * Retrieves the injected Zeta cell.
     */
    getCell() {
        if (!this.cell) {
            throw new Error("No Zeta cell has been injected into the Ace container.");
        }
        return this.cell;
    }
    /**
     * Registers a file-type plugin (looked up from CodecRegistry) by file extension.
     */
    registerPlugin(fileExtension, codecName) {
        const codec = CodecRegistry.get(codecName);
        if (!codec) {
            throw new Error(`Codec '${codecName}' not found in registry.`);
        }
        this.plugins.set(fileExtension, codec);
    }
    /**
     * Processes a package manifest file content, parses it into ZSet entries
     * using the correct plugin, and appends the delta to the injected Zeta cell.
     */
    async processManifest(fileExtension, content) {
        const plugin = this.plugins.get(fileExtension);
        if (!plugin) {
            throw new Error(`No package manager plugin registered for extension '${fileExtension}'`);
        }
        const delta = plugin.parse(content);
        return this.getCell().append(delta);
    }
    /**
     * Serializes the current accumulated cell state back into manifest file content using the plugin.
     */
    serializeState(fileExtension) {
        const plugin = this.plugins.get(fileExtension);
        if (!plugin) {
            throw new Error(`No package manager plugin registered for extension '${fileExtension}'`);
        }
        const state = this.getCell().getState();
        return plugin.serialize(state);
    }
}
