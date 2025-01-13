import { ViObject } from "../object/object";
import { ViTree } from "../tree/tree";

export class ViCommit extends ViObject {
    public hash: string;
    public timestamp: string;

    constructor(
        public tree: ViTree,
        public message: string,
        public parent: ViCommit | null = null
    ) {
        super();
        this.timestamp = new Date().toISOString();
        this.hash = this.generateHash();
    }
}