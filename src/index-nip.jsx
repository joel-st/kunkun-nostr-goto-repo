import { render } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { ui } from "@kksh/api/ui/custom"
import {
	ActionPanel,
	Button,
	Command,
	CommandEmpty,
	CommandFooter,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
	ThemeProvider,
	VertifcalSeparator
} from "@kksh/react"

import {
	GearIcon
} from "@radix-ui/react-icons"

import "./index.css"

const App = () => {
  const [value, setValue] = useState("linear")
	const actionInputRef = useRef<HTMLInputElement | null>(null)
	const [input, setInput] = useState("")
	const listRef = useRef(null)
	const seachInputEle = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
		ui.registerDragRegion()
		ui.showMoveButton({
			bottom: 0.2,
			left: 0.2
		})
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
						placeholder="Type a command or search..."
						className="h-12"
						onInput={(e) => {
							setInput(e.target.value)
						}}
						value={input}
						onKeyDown={onKeyDown}
					>
						<div className="h-8 w-8"></div>
					</CommandInput>
					<CommandList className="h-full">
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Suggestions">
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>Twitter</span>
							</CommandItem>
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>Instagram</span>
							</CommandItem>
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>LinkedIn</span>
							</CommandItem>
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>Search Emoji</span>
							</CommandItem>
							<CommandItem>
								<GearIcon className="mr-2 h-4 w-4" />
								<span>Launch</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
      </main>
    </ThemeProvider>
  )
}

render(<App />, document.getElementById("root"))