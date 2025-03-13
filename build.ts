import { watch } from "fs"
import { join } from "path"
import { refreshTemplateWorkerCommand } from "@kksh/api/dev"
import { $ } from "bun"

// Define an empty array to store entrypoints
const entrypoints: string[] = [];


if (Bun.argv.includes("--headless")) {
	entrypoints.push("./src/index-github.ts", "./src/index-nostrcom.ts")
} 

if (Bun.argv.includes("--template")) {
	entrypoints.push("./src/index-nip.ts")
}

async function build() {
	try {
		for (const entrypoint of entrypoints) {
			await $`bun build --minify --target=browser --outdir=./dist ${entrypoint}`
		}
		if (Bun.argv.includes("dev")) {
			await refreshTemplateWorkerCommand()
		}
	} catch (error) {
		console.error(error)
	}
}

const srcDir = join(import.meta.dir, "src")

await build()

if (Bun.argv.includes("dev")) {
	console.log(`Watching ${srcDir} for changes...`)
	watch(srcDir, { recursive: true }, async (event, filename) => {
		await build()
	})
}
