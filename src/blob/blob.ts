import { ViObject } from "../object/object";

export class ViBlob extends ViObject {
    constructor(
        public content: string
    ) {
        super();
        this.hash = this.generateHash();
    }
}