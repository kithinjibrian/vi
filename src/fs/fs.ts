import {
    mkdir,
    writeFile,
    readFile,
    stat,
    readdir
} from 'fs/promises';
import * as path from 'path';
import { ViRepo } from '../repo/repo';
import { ViBlob } from '../blob/blob';
import { ViTree } from '../tree/tree';
import { ViCommit } from '../commit/commit';

export class Fs {
    private basePath: string;
    private repo: ViRepo;
    private paths: {
        objects: string;
        refs: string;
        head: string;
        working: string;
    };

    constructor(repo: ViRepo, basePath: string) {
        this.repo = repo;
        this.basePath = path.resolve(basePath);
        this.paths = {
            objects: path.join(this.basePath, '.vi', 'objects'),
            refs: path.join(this.basePath, '.vi', 'refs'),
            head: path.join(this.basePath, '.vi', 'HEAD'),
            working: this.basePath,
        };
    }

    private async ensureDirectoryStructure(): Promise<void> {
        await mkdir(path.join(this.basePath, '.vi'), { recursive: true });
        await mkdir(this.paths.objects, { recursive: true });
        await mkdir(this.paths.refs, { recursive: true });
    }

    private getObjectPath(hash: string): { dir: string; path: string } {
        // Use first 2 chars for directory and rest for filename
        const dir = path.join(this.paths.objects, hash.substring(0, 2));
        const objectPath = path.join(dir, hash.substring(2));
        return { dir, path: objectPath };
    }

    private async saveObject(hash: string, content: string): Promise<void> {
        const { dir, path: objectPath } = this.getObjectPath(hash);
        try {
            await mkdir(dir, { recursive: true });
            await writeFile(objectPath, content, 'utf-8');
        } catch (error) {
            console.error(`Error saving object ${hash}:`, error);
            throw error;
        }
    }

    private async loadObject(hash: string): Promise<string> {
        const { path: objectPath } = this.getObjectPath(hash);
        try {
            return await readFile(objectPath, 'utf-8');
        } catch (error) {
            console.error(`Error loading object ${hash}:`, error);
            throw error;
        }
    }

    async saveWorkingDirectory(): Promise<void> {
        for (const [filename, content] of this.repo.getWorkingDirectory().entries()) {
            const filePath = path.join(this.paths.working, filename);
            try {
                await mkdir(path.dirname(filePath), { recursive: true });
                await writeFile(filePath, content, 'utf-8');
            } catch (error) {
                console.error(`Error saving file ${filename}:`, error);
                throw error;
            }
        }
    }

    private async isDirectory(filePath: string): Promise<boolean> {
        try {
            const stats = await stat(filePath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async loadWorkingDirectory(): Promise<void> {
        try {
            const files = await this.listFilesRecursively(this.paths.working);
            for (const file of files) {
                // Skip .vi directory and any directories
                if (file.includes('.vi') || await this.isDirectory(file)) {
                    continue;
                }

                const content = await readFile(file, 'utf-8');
                const relativePath = path.relative(this.paths.working, file);
                this.repo.getWorkingDirectory().set(relativePath, content);
            }
        } catch (error) {
            console.error('Error loading working directory:', error);
            throw error;
        }
    }

    private async listFilesRecursively(dir: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const items = await readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    if (item.name !== '.vi') {
                        files.push(...await this.listFilesRecursively(fullPath));
                    }
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
        return files;
    }

    async save(): Promise<void> {
        await this.ensureDirectoryStructure();

        // Save objects
        for (const [hash, obj] of this.repo.getAllObjects().entries()) {
            let content: string;

            if (obj instanceof ViBlob) {
                content = JSON.stringify({
                    type: 'blob',
                    content: obj.content
                });
            } else if (obj instanceof ViTree) {
                content = JSON.stringify({
                    type: 'tree',
                    entries: Array.from(obj.getEntries().entries())
                });
            } else if (obj instanceof ViCommit) {
                content = JSON.stringify({
                    type: 'commit',
                    tree: obj.tree.getHash(),
                    message: obj.message,
                    parent: obj.parent?.hash || null,
                    timestamp: obj.timestamp
                });
            } else {
                continue;
            }

            await this.saveObject(hash, content);
        }

        // Save refs (branches)
        for (const [name, hash] of this.repo.getRefs().entries()) {
            const refPath = path.join(this.paths.refs, name);
            await writeFile(refPath, hash);
        }

        // Save HEAD
        const head = this.repo.getHEAD();
        if (head) {
            await writeFile(this.paths.head, head);
        }

        // Save working directory files
        await this.saveWorkingDirectory();
    }

    async load(): Promise<void> {
        try {
            await this.ensureDirectoryStructure();
            this.repo.clear();

            // Load working directory
            await this.loadWorkingDirectory();

            // Load HEAD if it exists
            try {
                const head = await readFile(this.paths.head, 'utf-8');
                this.repo.setHEAD(head);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error;
                }
            }

            // Load refs (branches)
            try {
                const refs = await readdir(this.paths.refs);
                for (const ref of refs) {
                    const hash = await readFile(path.join(this.paths.refs, ref), 'utf-8');
                    this.repo.setRef(ref, hash);
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error;
                }
            }

            // Load objects
            try {
                const objectDirs = await readdir(this.paths.objects);
                for (const dir of objectDirs) {
                    const dirPath = path.join(this.paths.objects, dir);
                    if (!(await this.isDirectory(dirPath))) {
                        continue;
                    }

                    const files = await readdir(dirPath);
                    for (const file of files) {
                        const hash = dir + file;
                        const content = await this.loadObject(hash);
                        const data = JSON.parse(content);

                        let obj;
                        switch (data.type) {
                            case 'blob':
                                obj = new ViBlob(data.content);
                                break;
                            case 'tree':
                                obj = new ViTree();
                                for (const [name, entry] of data.entries) {
                                    if (entry.type === 'blob') {
                                        const blob = this.repo.getObject(entry.hash) as ViBlob;
                                        obj.addBlob(name, blob);
                                    } else {
                                        const tree = this.repo.getObject(entry.hash) as ViTree;
                                        obj.addTree(name, tree);
                                    }
                                }
                                break;
                            case 'commit':
                                const tree = this.repo.getObject(data.tree) as ViTree;
                                const parent = data.parent ? this.repo.getObject(data.parent) as ViCommit : null;
                                obj = new ViCommit(tree, data.message, parent);
                                Object.assign(obj, { timestamp: data.timestamp });
                                break;
                        }

                        if (obj) {
                            this.repo.addObject(hash, obj);
                        }
                    }
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error loading repository:', error);
            throw error;
        }
    }
}