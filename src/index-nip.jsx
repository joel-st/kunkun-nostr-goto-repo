import { render } from "preact"
import { useEffect, useState, useRef } from "preact/hooks"
import { ui } from "@kksh/api/ui/custom"
import {
  ThemeProvider,
  ThemeWrapper,
  Input
} from "@kksh/react"

import "./index.css"

const App = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const searchRef = useRef(null);

  useEffect(() => {
    ui.registerDragRegion()
    ui.showMoveButton({
      bottom: 0.2,
      left: 0.2
    })
  }, [])

  console.log('searchTerm', searchTerm)

  return (
    <ThemeProvider storageKey="kk-ui-theme">
      <ThemeWrapper>
        <main className="h-screen flex flex-col">
          <Input
            autoFocus
            ref={searchRef}
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ height: "3.25rem", paddingLeft: "3.25rem"}}
            className="w-full rounded-none border-l-0 border-r-0 border-t-0 focus:outline-none focus:ring-0"
          />
        </main>
      </ThemeWrapper>
    </ThemeProvider>
  )
}

render(<App />, document.getElementById("root"))
