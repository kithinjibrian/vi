import { Fs } from "./fs/fs";
import { ViRepo } from "./repo/repo";

async function main() {
    const repo = new ViRepo();
    const storage = new Fs(repo, './my-project');


    //  repo.getWorkingDirectory().set('example.txt', 'Hello, World!');
    //  repo.add('example.txt');
    // repo.commit('Initial commit');


    await storage.load();

    console.log(repo.log())
}

main().catch(console.error);