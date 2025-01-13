import { nanoid } from "nanoid"

export abstract class ViObject {
    public hash: string = "";

    protected generateHash() {
        return nanoid();
    }
}