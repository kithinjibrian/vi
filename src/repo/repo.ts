import { ViBlob } from "../blob/blob";
import { ViCommit } from "../commit/commit";
import { ViObject } from "../object/object";
import { ViTree } from "../tree/tree";

export interface ViCommitLog {
    hash: string;
    message: string;
    timestamp: string;
    branch: string | null
}

export class ViRepo {
    private objects: Map<string, ViObject>;
    private refs: Map<string, string>;
    private HEAD: string | null;
    private workingDirectory: Map<string, string>;
    private staging: Map<string, string>;

    constructor() {
        this.objects = new Map();
        this.refs = new Map();
        this.HEAD = null;
        this.workingDirectory = new Map();
        this.staging = new Map();
    }

    createBlob(content: string): ViBlob {
        const blob = new ViBlob(content);
        this.objects.set(blob.hash, blob);
        return blob;
    }

    add(filename: string): void {
        if (this.workingDirectory.has(filename)) {
            this.staging.set(filename, this.workingDirectory.get(filename)!);
        }
    }

    remove(filename: string): void {
        this.workingDirectory.delete(filename);
        this.staging.set(filename, "");
    }

    commit(message: string): ViCommit {
        const tree = new ViTree();

        // Add staged files to tree
        for (const [filename, content] of this.staging.entries()) {
            const blob = this.createBlob(content);
            tree.addBlob(filename, blob);
        }


        // Create and store the commit
        const parentCommit = this.HEAD ? this.objects.get(this.HEAD) as ViCommit : null;
        const commit = new ViCommit(tree, message, parentCommit);
        this.objects.set(commit.hash, commit);
        this.objects.set(tree.getHash(), tree);

        // Update HEAD and current branch
        this.HEAD = commit.hash;
        const currentBranch = this.getCurrentBranch();
        if (currentBranch) {
            this.refs.set(currentBranch, commit.hash);
        }

        // Clear staging area
        this.staging.clear();

        return commit;
    }

    createBranch(name: string): void {
        if (this.HEAD) {
            this.refs.set(name, this.HEAD);
        }
    }

    checkout(branchName: string): boolean {
        if (this.refs.has(branchName)) {
            this.HEAD = this.refs.get(branchName)!;
            this.loadWorkingDirectory();
            return true;
        }
        return false;
    }

    getCurrentBranch(): string | null {
        for (const [name, hash] of this.refs.entries()) {
            if (hash === this.HEAD) {
                return name;
            }
        }
        return null;
    }

    loadWorkingDirectory(): void {
        this.workingDirectory.clear();
        if (!this.HEAD) return;

        const commit = this.objects.get(this.HEAD) as ViCommit;
        const tree = commit.tree;

        for (const [filename, entry] of tree.getEntries().entries()) {
            if (entry.type === 'blob') {
                const blob = this.objects.get(entry.hash) as ViBlob;
                this.workingDirectory.set(filename, blob.content);
            }
        }
    }

    log(limit?: number): ViCommitLog[] {
        const history: ViCommitLog[] = [];
        let currentCommit = this.HEAD ? this.objects.get(this.HEAD) as ViCommit : null;

        while (currentCommit && (!limit || history.length < limit)) {
            history.push({
                hash: currentCommit.hash,
                message: currentCommit.message,
                timestamp: currentCommit.timestamp,
                branch: this.getCurrentBranch(),
            });
            currentCommit = currentCommit.parent;
        }

        return history;
    }

    // Helper methods for debugging and testing
    getWorkingDirectory(): Map<string, string> {
        return this.workingDirectory;
    }

    getStaging(): Map<string, string> {
        return new Map(this.staging);
    }

    getAllObjects(): Map<string, ViObject> {
        return new Map(this.objects);
    }

    getRefs(): Map<string, string> {
        return new Map(this.refs);
    }

    getHEAD(): string | null {
        return this.HEAD;
    }

    getObject(hash: string): ViObject | undefined {
        return this.objects.get(hash);
    }

    addObject(hash: string, obj: ViObject): void {
        this.objects.set(hash, obj);
    }

    setRef(name: string, hash: string): void {
        this.refs.set(name, hash);
    }

    setHEAD(hash: string): void {
        this.HEAD = hash;
    }

    clear(): void {
        this.objects.clear();
        this.refs.clear();
        this.HEAD = null;
        this.workingDirectory.clear();
        this.staging.clear();
    }
}