import { ViBlob } from "../blob/blob";
import { ViObject } from "../object/object";

interface TreeEntry {
    type: 'blob' | 'tree';
    hash: string;
}

export class ViTree extends ViObject {
    private entries: Map<string, TreeEntry>;

    constructor() {
        super();
        this.entries = new Map();
    }

    /**
     * Add a file (blob) to the tree
     * @param name - Name of the file
     * @param blob - Blob object containing file content
     */
    addBlob(name: string, blob: ViBlob): void {
        this.entries.set(name, {
            type: 'blob',
            hash: blob.hash
        });
    }

    /**
     * Add a directory (subtree) to the tree
     * @param name - Name of the directory
     * @param tree - Tree object representing the directory
     */
    addTree(name: string, tree: ViTree): void {
        this.entries.set(name, {
            type: 'tree',
            hash: tree.getHash()
        });
    }

    /**
     * Get all entries in the tree
     * @returns Map of entry names to their metadata
     */
    getEntries(): Map<string, TreeEntry> {
        return this.entries;
    }

    /**
     * Calculate the hash of this tree
     * Creates a deterministic hash based on all entries
     * @returns Hash string
     */
    getHash(): string {
        return this.generateHash();
    }

    /**
     * Find an entry in the tree
     * @param path - Path to the entry (can include '/')
     * @returns TreeEntry if found, undefined otherwise
     */
    findEntry(path: string): TreeEntry | undefined {
        const parts = path.split('/');
        const name = parts[0];
        const entry = this.entries.get(name);

        if (!entry) {
            return undefined;
        }

        if (parts.length === 1) {
            return entry;
        }

        // If we're looking for a nested path and this is a tree,
        // continue searching in the subtree
        if (entry.type === 'tree') {
            // Note: This would require repository access to load the subtree
            // Implementation would depend on how we store/access objects
            return undefined;
        }

        return undefined;
    }
}