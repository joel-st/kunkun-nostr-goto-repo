import { expose, HeadlessCommand } from "@kksh/api/headless"
import { open } from "@kksh/api/headless";

class NostrOpenNipRepo extends HeadlessCommand {
	async load() {
		return open.url("https://github.com/nostr-protocol/nips")
	}
}

expose(new NostrOpenNipRepo())
