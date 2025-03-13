import { expose, HeadlessCommand } from "@kksh/api/headless"
import { open } from "@kksh/api/headless";

class NostrOpenNipRepoGithub extends HeadlessCommand {
	async load() {
		return open.url("https://github.com/nostr-protocol/nips")
	}
}

expose(new NostrOpenNipRepoGithub())
