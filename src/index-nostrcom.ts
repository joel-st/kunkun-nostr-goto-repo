import { expose, HeadlessCommand } from "@kksh/api/headless"
import { open } from "@kksh/api/headless";

class NostrOpenNipRepoNostrCom extends HeadlessCommand {
	async load() {
		return open.url("https://nips.nostr.com/")
	}
}

expose(new NostrOpenNipRepoNostrCom())
