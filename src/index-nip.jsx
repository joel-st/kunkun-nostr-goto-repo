import { render, Fragment } from "preact"
import { useEffect, useState, useRef } from "preact/hooks"
import { ui, db, open } from "@kksh/api/ui/custom"
import {
  ThemeProvider,
  ThemeWrapper,
  Input,
  Button,
} from "@kksh/react"

import { Icon } from "@iconify/react";
import { h } from "preact";

import "./index.css"

const App = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [nips, setNips] = useState([])
  const [filteredNips, setFilteredNips] = useState([])
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState("nostr")
  const [showSettings, setShowSettings] = useState(false)
  const searchRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsIconRef = useRef(null);

  // Close settings panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close settings if clicking outside both the settings panel and the settings icon
      if (
        settingsRef.current && 
        !settingsRef.current.contains(event.target) &&
        settingsIconRef.current &&
        !settingsIconRef.current.contains(event.target)
      ) {
        setShowSettings(false);
      }
    };

    // Using mousedown for better mobile support
    if (showSettings) {
      // Add a slight delay to ensure event processing happens after React's event handling
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

  // Sort NIPs function
  const sortNips = (nips) => {
    return nips.sort((a, b) => {
      const aIsNumeric = /^\d+$/.test(a.nip.replace(/^0+/, '')); // Remove leading zeros for numeric comparison
      const bIsNumeric = /^\d+$/.test(b.nip.replace(/^0+/, ''));
      
      // If both are numeric, sort by number
      if (aIsNumeric && bIsNumeric) {
        return parseInt(a.nip) - parseInt(b.nip);
      }
      
      // If only a is numeric, a comes first
      if (aIsNumeric) return -1;
      
      // If only b is numeric, b comes first
      if (bIsNumeric) return 1;
      
      // If both are non-numeric, sort alphabetically
      return a.nip.localeCompare(b.nip);
    });
  };

  // Fetch NIPs from GitHub
  const fetchNostrNips = async () => {
    try {
      // Fetch the README.md file from the repository
      const response = await fetch('https://api.github.com/repos/nostr-protocol/nips/contents/README.md');
      const fileData = await response.json();
      
      // Decode content from base64
      const content = atob(fileData.content);
      
      // Updated regex to match both numeric and alphanumeric NIP identifiers
      const nipRegex = /\- \[NIP-([0-9A-Za-z]+)\: (.*?)\]\(([0-9A-Za-z]+\.md)\)/g;
      
      const nipsArray = [];
      let match;
      
      // Find all matches in the content
      while ((match = nipRegex.exec(content)) !== null) {
        const nipId = match[1]; // This can be numeric or alphanumeric
        const title = match[2];
        const filename = match[3];
        
        // Generate URLs based on NIP identifier
        const urlGithub = `https://github.com/nostr-protocol/nips/blob/master/${filename}`;
        
        // For nostr.com URL, only use numeric format for numeric NIPs
        const isNumeric = /^\d+$/.test(nipId);
        const nipNumberNoPad = isNumeric ? parseInt(nipId) : nipId;
        const urlNostrCom = `https://nips.nostr.com/${nipNumberNoPad}`;
        
        // Format the NIP identifier consistently for display
        const formattedNipId = isNumeric ? nipId.padStart(2, '0') : nipId;
        
        // Transform title to JSX with code elements for backticked text
        const transformTitleToJsx = (titleText) => {
          if (!titleText.includes('`')) return titleText;
          
          const parts = titleText.split(/(`[^`]+`)/);
          return parts.map((part, index) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              // Remove the backticks and wrap in code element
              return h('code', { key: index, className: 'bg-gray-100 dark:bg-gray-800 py-1 px-1.5 rounded text-sm' }, part.slice(1, -1));
            }
            return part;
          });
        };
        
        nipsArray.push({
          nip: formattedNipId,
          title: transformTitleToJsx(title),
          rawTitle: title, // Store raw title without formatting
          urlGithub: urlGithub,
          urlNostrCom: urlNostrCom,
          content: `NIP-${formattedNipId}: ${title}`,
          kinds: [], // Initialize with empty array, will be populated later
          tags: [] // Initialize with empty array, will be populated later
        });
      }
      
      // Parse the Event Kinds table
      const eventKindsSection = content.match(/## Event Kinds\s+([\s\S]+?)(?=##|$)/);
      if (eventKindsSection && eventKindsSection[1]) {        
        // split table by rows first, then columns for better parsing
        const kindTableRows = [];
        const kindTableContent = eventKindsSection[1].trim();
        const kindTableLines = kindTableContent.split('\n').filter(line => line.trim() !== '');
        
        // Skip the header and separator rows
        for (let i = 2; i < kindTableLines.length; i++) {
          const row = kindTableLines[i];
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
          
          if (cells.length >= 3) {
            const kindCell = cells[0];
            const descriptionCell = cells[1];
            
            // Parse the kind value - handle both single numbers and ranges
            let kinds = [];
            
            // Match single numbers: `123`
            const singleMatch = kindCell.match(/`(\d+)`/g);
            if (singleMatch) {
              singleMatch.forEach(match => {
                const num = parseInt(match.replace(/`/g, ''));
                if (!isNaN(num)) {
                  kinds.push(num);
                }
              });
            }
            
            // Match ranges: `10`-`20`
            const rangeMatch = kindCell.match(/`(\d+)`\s*-\s*`(\d+)`/);
            if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
              const start = parseInt(rangeMatch[1]);
              const end = parseInt(rangeMatch[2]);
              
              if (!isNaN(start) && !isNaN(end)) {
                for (let j = start; j <= end; j++) {
                  kinds.push(j);
                }
              }
            }

            let nipCell = cells[2];

            // parse the nipCell
            let extractedNips = [];
            
            // Pattern 1: [number|alphanumeric](number|alphanumeric.md) - e.g. "[01](01.md)"
            const pattern1 = /\[([0-9A-Za-z]+)\]\([0-9A-Za-z]+\.md\)/g;
            let match1;
            while ((match1 = pattern1.exec(nipCell)) !== null) {
              extractedNips.push(match1[1]);
            }
            
            // Pattern 2: number|alphanumeric (deprecated) - e.g. "01 (deprecated)"
            const pattern2 = /([0-9A-Za-z]+)\s+\(deprecated\)/g;
            let match2;
            while ((match2 = pattern2.exec(nipCell)) !== null) {
              extractedNips.push(match2[1]);
            }
            
            if (kinds.length > 0 && extractedNips.length > 0) {
              kindTableRows.push([kinds, descriptionCell, extractedNips]);
            }
          }
        }
        
        // Process the parsed rows
        kindTableRows.forEach(row => {
          const kinds = row[0];
          const extractedNips = row[2]; // Get the extractedNips array from the row
          
          // Use the extracted NIPs directly
          extractedNips.forEach(nipId => {
            // Find the corresponding NIP in our array
            const nip = nipsArray.find(n => n.nip === nipId || (nipId.startsWith('0') && n.nip === nipId.replace(/^0+/, '')));
            if (nip) {
              // Add these kinds to the NIP
              nip.kinds = [...nip.kinds, ...kinds];
              // Remove duplicates
              nip.kinds = [...new Set(nip.kinds)];
            }
          });
        });
      }
      
    // Parse the Event Tags table
    const eventTagsSection = content.match(/## Standardized Tags\s+([\s\S]+?)(?=##|$)/);
    if (eventTagsSection && eventTagsSection[1]) {
      // split table by rows first, then columns for better parsing
      const tagTableRows = [];
      const tagTableContent = eventTagsSection[1].trim();
      const tagTableLines = tagTableContent.split('\n').filter(line => line.trim() !== '');

      // Skip the header and separator rows
      for (let i = 2; i < tagTableLines.length; i++) {
        const row = tagTableLines[i];
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        
        if (cells.length >= 3) {
          const tagCell = cells[0];
          const descriptionCell = cells[1];
          const otherParameterCell = cells[2];
          
          // Parse the kind value - handle both single numbers and ranges
          let tags = false;
          
          // Match single strings: `string`
          const singleMatch = tagCell.match(/`(.*?)`/g);
          if (singleMatch) {
            tags = singleMatch[0].replace(/`/g, '');
          }

          let nipCell = cells[3];

          // parse the nipCell
          let extractedNips = [];
          
          // Pattern 1: [number|alphanumeric](number|alphanumeric.md) - e.g. "[01](01.md)"
          const pattern1 = /\[([0-9A-Za-z]+)\]\([0-9A-Za-z]+\.md\)/g;
          let match1;
          while ((match1 = pattern1.exec(nipCell)) !== null) {
            extractedNips.push(match1[1]);
          }

          if (tags.length > 0 && extractedNips.length > 0) {
            tagTableRows.push([tags, descriptionCell, otherParameterCell,extractedNips]);
          }

        }
      }
      
      console.log('tagTableRows', tagTableRows)
      
      // Process the parsed rows
      tagTableRows.forEach(row => {
        const tags = row[0];
        const extractedNips = row[3]; // Get the extractedNips array from the row
        
        // Use the extracted NIPs directly
        extractedNips.forEach(nipId => {
          // Find the corresponding NIP in our array
          const nip = nipsArray.find(n => n.nip === nipId || (nipId.startsWith('0') && n.nip === nipId.replace(/^0+/, '')));
          if (nip) {
            // Add these tags to the NIP
            nip.tags = [...nip.tags, tags];
            // Remove duplicates
            nip.tags = [...new Set(nip.tags)];
          }
        });
      });
    }

      // Sort NIPs
      return sortNips(nipsArray);
    } catch (error) {
      console.error('Error fetching NIPs:', error);
      return [];
    }
  };

  // Filter NIPs based on search query
  const filterNips = (query) => {
    if (!query) {
      return nips;
    }
    
    // Check if the query contains a kind search pattern (e.g., k=1, k=10002)
    const kindSearchQuery = query.toLowerCase();
    const kindMatch = kindSearchQuery.match(/k=(\d+)/);

    // Check if the query contains a tag search pattern (e.g., t=name, t=t, t=clone)
    const tagSearchQuery = query;
    const tagMatch = tagSearchQuery.match(/t=([a-zA-Z0-9_-]+)/);

    let filtered = nips.filter(nip => {
      // If there's a kind match, check if this NIP includes that kind
      if (kindMatch && nip.kinds && nip.kinds.includes(parseInt(kindMatch[1]))) {
        console.log('kindMatch', kindMatch, nip);
      }
      
      // If there's a tag match, check if this NIP includes that tag (case sensitive)
      const hasTagMatch = tagMatch && nip.tags && nip.tags.includes(tagMatch[1]);
      if (hasTagMatch) {
        console.log('tagMatch', tagMatch, nip);
      }
      
      // Always perform text search regardless of kind/tag match
      // We use rawTitle for searching since title may now be a JSX element
      return nip.rawTitle.toLowerCase().includes(query.toLowerCase()) || 
        nip.nip.toLowerCase().includes(query.toLowerCase()) ||
        nip.content.toLowerCase().includes(query.toLowerCase()) ||
        (kindMatch && nip.kinds && nip.kinds.includes(parseInt(kindMatch[1]))) ||
        hasTagMatch;
    });

    return sortNips(filtered);
  };

  // Handle search input change
  useEffect(() => {
    setFilteredNips(filterNips(searchTerm));
  }, [searchTerm, nips]);

  // Load NIPs and preferences on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Load NIPs
        const fetchedNips = await fetchNostrNips();
        setNips(fetchedNips);
        setFilteredNips(fetchedNips);
        
        // Load preferences
        try {
          const data = await db.retrieveAll({
            fields: ["data", "search_text"],
          });
    
          if (data.length > 0 && data[0].data) {
            const pref = JSON.parse(data[0].data) || 'nostr';
            setPreferences(pref);
          }
        } catch (error) {
          console.error('Failed to load preferences:', error);
        }
      } catch (error) {
        console.error('Failed to load NIPs:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle opening a NIP
  const openNip = (nip) => {
    const url = preferences === "nostr" ? nip.urlNostrCom : nip.urlGithub;
    open.url(url);
  };

  // Handle changing preference
  const changePreference = async (pref) => {
    await db.deleteAll();
    await db.add({
      data: JSON.stringify(pref),
      dataType: "preference",
      searchText: "open_with",
    });
    setPreferences(pref);
  };

  useEffect(() => {
    ui.registerDragRegion()
    ui.showMoveButton({
      bottom: 0.2,
      left: 0.2
    })
  }, [])

  console.log('searchTerm', searchTerm)
  console.log('filteredNips', filteredNips)

  return (
    <ThemeProvider storageKey="kk-ui-theme">
      <ThemeWrapper>
        <main className="h-screen flex flex-col">
          <Input
            autoFocus
            ref={searchRef}
            type="text"
            placeholder="Number, Title, k(ind)=x, t(ag)=x …"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ height: "3.25rem", paddingLeft: "3.25rem"}}
            className="w-full rounded-none border-l-0 border-r-0 border-t-0 focus:outline-none focus:ring-0"
          />
          <div className="flex-1 overflow-y-auto">
              {filteredNips.length > 0 && (
                <div className="px-4 pt-4 text-xs flex justify-between items-center">
                  <p>Nostr Implementation Possibilities ({filteredNips.length})</p>
                  <div
                    ref={settingsIconRef}
                    role="button"
                    tabIndex={0}
                    aria-label={showSettings ? "Close settings" : "Open settings"}
                    aria-expanded={showSettings}
                    className={`p-1.5 rounded-full cursor-pointer ${showSettings 
                      ? 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                      : 'hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettings(!showSettings);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowSettings(!showSettings);
                      }
                    }}
                  >
                    <Icon 
                      icon={showSettings ? "mage:settings-fill" : "carbon:settings"}
                      width="16" 
                      height="16" 
                    />
                  </div>
                </div>
              )}
              
              {showSettings && (
                <div 
                  ref={settingsRef}
                  className="mx-2 mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-md"
                  onClick={(e) => {
                    // Stop propagation to prevent other handlers from firing
                    e.stopPropagation();
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-medium">Open links with:</p>
                    <div 
                      className="cursor-pointer p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" 
                      onClick={() => setShowSettings(false)}
                    >
                      <Icon icon="mdi:close" width="14" height="14" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="linkPreference"
                        value="nostr"
                        checked={preferences === "nostr"}
                        onChange={(e) => {
                          e.stopPropagation();
                          changePreference("nostr");
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2"
                      />
                      <span className="text-sm">Nostr.com</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="linkPreference"
                        value="github"
                        checked={preferences === "github"}
                        onChange={(e) => {
                          e.stopPropagation();
                          changePreference("github");
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2"
                      />
                      <span className="text-sm">GitHub.com</span>
                    </label>
                  </div>
                </div>
              )}
              
            {loading && <div className="px-2 py-10 text-center text-lg">Loading...</div>}
            {filteredNips.length > 0 && (
              <ul className="px-2 pt-2 pb-10 cursor-pointer">
                {filteredNips.map(nip => (
                  <li 
                    key={nip.nip} 
                    className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    onClick={() => openNip(nip)}
                  >
                    <div className="flex-shrink-0 pr-2">
                      {preferences === "nostr" ? (
                        <Icon icon="game-icons:ostrich" width="20" height="20" />
                      ) : (
                        <Icon icon="mdi:github" width="20" height="20" />
                      )}
                    </div>
                    <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis mr-2">
                      <strong className="pr-1">NIP-{nip.nip}</strong> {nip.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {filteredNips.length === 0 && !loading && <div className="px-2 py-10 text-center text-lg">No results found 🥲</div>}
          </div>
        </main>
      </ThemeWrapper>
    </ThemeProvider>
  )
}

render(<App />, document.getElementById("root"))
