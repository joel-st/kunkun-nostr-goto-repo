import { render, Fragment } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { ui, open } from "@kksh/api/ui/custom"
import { Button } from "@kksh/react"
import { Icon } from "@iconify/react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	ThemeProvider
} from "@kksh/react"

import {
	OpenInNewWindowIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons"

import "./index.css"

// Function to fetch NIPs from GitHub
async function fetchNostrNips() {
	try {
		// Fetch the README.md file from the repository
		const response = await fetch('https://api.github.com/repos/nostr-protocol/nips/contents/README.md');
		const fileData = await response.json();
		
		// Decode content from base64
		const content = atob(fileData.content);
		
		// Regular expression to match NIP entries in the list
		// Format is like: - [NIP-01: Basic protocol flow description](01.md)
		const nipRegex = /\- \[NIP-(\d+)\: (.*?)\]\((\d+\.md)\)/g;
		
		const nips = [];
		let match;
		
		// Find all matches in the content
		while ((match = nipRegex.exec(content)) !== null) {
			const nipNumber = match[1].padStart(2, '0'); // Pad to ensure consistent format like "01"
			const nipNumberNoPad = parseInt(nipNumber); // remove leading zeros
      const title = <Fragment>{match[2].split(/`([^`]+)`/).map((part, i) => 
				i % 2 === 0 ? part : <code className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5" key={i}>{part}</code>
			)}</Fragment>;

			const filename = match[3];
      
			nips.push({
				nip: nipNumber,
				title: title,
        rawTitle: match[2],
				urlGithub: `https://github.com/nostr-protocol/nips/blob/master/${filename}`,
				urlNostrCom: `https://nips.nostr.com/${nipNumberNoPad}`,
				// We're not fetching full content anymore, but we need to provide a placeholder
				// for the filtering function that uses content
				content: `NIP-${nipNumber}: ${title}` 
			});
		}
		
		// Sort NIPs by number
		return nips.sort((a, b) => parseInt(a.nip) - parseInt(b.nip));
	} catch (error) {
		console.error('Error fetching NIPs:', error);
		return [];
	}
}

const App = () => {
	const [input, setInput] = useState("")
	const seachInputEle = useRef(null)
	const [nips, setNips] = useState([])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		ui.registerDragRegion()
		ui.showMoveButton({
			bottom: 0.2,
			left: 0.2
		})
		
		// Fetch NIPs when component mounts
		const loadNips = async () => {
			setLoading(true)
			try {
				const fetchedNips = await fetchNostrNips()
				setNips(fetchedNips)
			} catch (error) {
				console.error('Failed to load NIPs:', error)
			} finally {
				setLoading(false)
			}
		}
		
		loadNips()
	}, [])

	function onKeyDown(e) {
		if (e.key === "Escape") {
			if (input.length === 0) {
				ui.goBack()
			} else {
				setInput("")
			}
		}
	}

	// Filter NIPs based on input
	const filteredNips = input 
		? nips.filter(nip => 
			nip.rawTitle.toLowerCase().includes(input.toLowerCase()) || 
			nip.nip.includes(input) ||
			nip.content.toLowerCase().includes(input.toLowerCase())
		)
		: nips

	return (
		<ThemeProvider>
			<main className="h-screen">
				<Command
					onValueChange={(v) => {
						setValue(v)
					}}
				>
					<CommandInput
						autoFocus
						ref={seachInputEle}
						placeholder="Search NIPs by number or title..."
						style={{height: '3.25rem'}}
						onInput={(e) => {
							setInput(e.target.value)
						}}
						value={input}
						onKeyDown={onKeyDown}
					>
						<div className="h-8 w-8"></div>
					</CommandInput>
					<CommandList className="h-full">
						{loading ? (
							<div className="p-4 text-center">Loading NIPs...</div>
						) : (
							<Fragment>
								<CommandEmpty>No NIPs found.</CommandEmpty>
								<CommandGroup heading="Nostr Implementation Possibilities">
									{filteredNips.map((nip) => (
										<CommandItem 
											key={nip.nip}
                    >
											<div className="flex items-center justify-between w-full">
												<div className="truncate">
													<span className="font-bold">NIP-{nip.nip}</span>: {nip.title}
												</div>
												<div className="flex space-x-2 ml-2">
													<Button 
														style={{padding: '.1em .4em'}}
														onClick={(e) => {
															e.stopPropagation();
															open.url(nip.urlNostrCom);
														}}
														title="Open on nips.nostr.com"
													>
														<Icon icon="game-icons:ostrich" width="20" height="20" />
													</Button>
													<Button 
                            style={{padding: '.1em .4em'}}
														onClick={(e) => {
															e.stopPropagation();
															open.url(nip.urlGithub);
														}}
														title="Open on GitHub"
													>
														<Icon icon="mdi:github" width="20" height="20" />
													</Button>
												</div>
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</Fragment>
						)}
					</CommandList>
				</Command>
			</main>
		</ThemeProvider>
	)
}

render(<App />, document.getElementById("root"))