import {
  Action,
  expose,
  Icon,
  IconEnum,
  List,
  open,
  TemplateUiCommand,
  toast,
  ui,
  db
} from "@kksh/api/ui/template";

interface Nip {
  nip: string;
  title: string;
  rawTitle: string;
  urlGithub: string;
  urlNostrCom: string;
  content: string;
  kinds: number[];
}

class NostrOpenSpecificNip extends TemplateUiCommand {
  private nips: Nip[] = [];
  private preferences: string = "";
  private loading: boolean = false;
  private searchQuery: string = "";
  private filteredNips: Nip[] = [];

  async load() {
    this.loading = true;
    this.updateUI();
    try {
      // Fetch NIPs
      this.nips = await this.fetchNostrNips();
      this.filteredNips = this.nips;
    } catch (error) {
      console.error('Failed to load NIPs:', error);
    } finally {
      this.loading = false;
      this.updateUI();
    }

    try {
      const data = await db.retrieveAll({
        fields: ["data", "search_text"],
      });

      if (data.length > 0 && data[0].data) {
        this.preferences = JSON.parse(data[0].data) ? JSON.parse(data[0].data) : 'nostr';
        this.updateUI();
      } else {
        this.preferences = 'nostr';
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }

  sortNips(nips: Nip[]): Nip[] {
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
  }

  // Function to fetch NIPs from GitHub
  async fetchNostrNips(): Promise<Nip[]> {
    try {
      // Fetch the README.md file from the repository
      const response = await fetch('https://api.github.com/repos/nostr-protocol/nips/contents/README.md');
      const fileData = await response.json();
      
      // Decode content from base64
      const content = atob(fileData.content);
      
      // Updated regex to match both numeric and alphanumeric NIP identifiers
      // Format can be like: 
      // - [NIP-01: Basic protocol flow description](01.md)
      // - [NIP-7D: Threads](7D.md)
      const nipRegex = /\- \[NIP-([0-9A-Za-z]+)\: (.*?)\]\(([0-9A-Za-z]+\.md)\)/g;
      
      const nips: Nip[] = [];
      let match;
      
      // Find all matches in the content
      while ((match = nipRegex.exec(content)) !== null) {
        const nipId = match[1]; // This can be numeric or alphanumeric
        const title = match[2];
        const filename = match[3];
        
        // Generate URLs based on NIP identifier
        const urlGithub = `https://github.com/nostr-protocol/nips/blob/master/${filename}`;
        
        // For nostr.com URL, only use numeric format for numeric NIPs
        // For alphanumeric NIPs, we'll still use the same format but be aware it might not work properly
        const isNumeric = /^\d+$/.test(nipId);
        const nipNumberNoPad = isNumeric ? parseInt(nipId) : nipId;
        const urlNostrCom = `https://nips.nostr.com/${nipNumberNoPad}`;
        
        // Format the NIP identifier consistently for display
        // For numeric NIPs, pad with leading zero if needed
        const formattedNipId = isNumeric ? nipId.padStart(2, '0') : nipId;
        
        nips.push({
          nip: formattedNipId,
          title: title,
          rawTitle: title, // Store raw title without formatting
          urlGithub: urlGithub,
          urlNostrCom: urlNostrCom,
          content: `NIP-${formattedNipId}: ${title}`,
          kinds: [] // Initialize with empty array, will be populated later
        });
      }
      
      // Parse the Event Kinds table
      // This table is located after the "## Event Kinds" heading
      const eventKindsSection = content.match(/## Event Kinds\s+([\s\S]+?)(?=##|$)/);
      if (eventKindsSection && eventKindsSection[1]) {        
        // split table by rows first, then columns for better parsing
        const tableRows: Array<[number[], string, string[]]> = [];
        const tableContent = eventKindsSection[1].trim();
        const tableLines = tableContent.split('\n').filter(line => line.trim() !== '');
        
        // Skip the header and separator rows
        for (let i = 2; i < tableLines.length; i++) {
          const row = tableLines[i];
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
          
          if (cells.length >= 3) {
            const kindCell = cells[0];
            const descriptionCell = cells[1];
            
            // Parse the kind value - handle both single numbers and ranges
            let kinds: number[] = [];
            
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
            let extractedNips: string[] = [];
            
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
            
            // Pattern 3: [number|alphanumeric](number|alphanumeric.md), [number|alphanumeric](number|alphanumeric.md), ...
            // This is already handled by pattern1, as it will match each occurrence in a comma-separated list
            
            if (kinds.length > 0 && extractedNips.length > 0) {
              tableRows.push([kinds, descriptionCell, extractedNips]);
            }
          }
        }
        
        // Process the parsed rows
        tableRows.forEach(row => {
          const kinds = row[0];
          const extractedNips = row[2]; // Get the extractedNips array from the row
          
          // Use the extracted NIPs directly instead of parsing again
          extractedNips.forEach(nipId => {
            // Find the corresponding NIP in our array
            const nip = nips.find(n => n.nip === nipId || (nipId.startsWith('0') && n.nip === nipId.replace(/^0+/, '')));
            if (nip) {
              // Add these kinds to the NIP
              nip.kinds = [...nip.kinds, ...kinds];
              // Remove duplicates
              nip.kinds = [...new Set(nip.kinds)];
            }
          });
        });
      }
      
      // Sort NIPs: numeric ones first (sorted by number), then alphanumeric (sorted alphabetically)
      return this.sortNips(nips);
    } catch (error) {
      console.error('Error fetching NIPs:', error);
      return [];
    }
  }

  // Filter NIPs based on search query
  async setFilteredNips(): Promise<void> {

    if (!this.searchQuery) {
      this.filteredNips = this.nips
    }
    
    const query = this.searchQuery.toLowerCase();
    
    // Check if the query contains a kind search pattern (e.g., k1, k10002)
    const kindMatch = query.match(/k(\d+)/);
    
    let filteredNips = this.nips.filter(nip => {
      // If there's a kind match, check if this NIP includes that kind
      if (kindMatch && nip.kinds.includes(parseInt(kindMatch[1]))) {
          console.log('kindMatch', kindMatch, nip);
      }
      
      // Always perform text search regardless of kind match
      return nip.rawTitle.toLowerCase().includes(query) || 
        nip.nip.toLowerCase().includes(query) ||
        nip.content.toLowerCase().includes(query) ||
        (kindMatch && nip.kinds.includes(parseInt(kindMatch[1])));
    });

    this.filteredNips = this.sortNips(filteredNips);
    this.updateUI();
  }

  // Handle search input change
  async onSearchTermChange(query: string): Promise<void> {
    this.searchQuery = query;
    await this.setFilteredNips();
  }

  // Create action panel for the footer
  getFooterActions(): Action.Action[] {
    let actions = [
      new Action.Action({
        title: "Always open on nips.nostr.com",
        value: "open-nostr",
        icon: new Icon({
          type: IconEnum.Iconify,
          value: "game-icons:ostrich",
        }),
      }),
      new Action.Action({
        title: "Always open on GitHub",
        value: "open-github",
        icon: new Icon({
          type: IconEnum.Iconify,
          value: "mdi:github",
        }),
      }),
    ];

    if (this.preferences === "github") {
      actions.reverse()
    }
    
    return actions;
  }


  async updateUI() {
    return ui
      .setSearchBarPlaceholder("Number, Title, k[X], t[X]…")
      .then(() => {
        return ui.render(
          new List.List({
            sections: [
              new List.Section({
                title: "Nostr Implementation Possibilities",
                items: this.filteredNips.map(
                  (nip) =>
                    new List.Item({
                      title: `NIP-${nip.nip}: ${nip.title}`,
                      value: this.preferences === "nostr" ? nip.urlNostrCom : nip.urlGithub,
                      icon: new Icon({
                        type: IconEnum.Iconify,
                        value: "majesticons:open",
                      }),
                    })
                ),
              }),
            ],
            actions: new Action.ActionPanel({
              items: this.getFooterActions(),
            }),
          })
        );
      });
  }

  onListItemSelected(value: string): Promise<void> {
    return open.url(value);
  }

  async onActionSelected(value: string): Promise<void> {    
    if (value === "open-nostr") {
      await db.deleteAll();
      await db.add({
        data: JSON.stringify('nostr'),
        dataType: "preference",
        searchText: "open_with",
      });
      this.preferences = 'nostr';
      this.updateUI();
    }

    if (value === "open-github") {
      await db.deleteAll();
      await db.add({
        data: JSON.stringify('github'),
        dataType: "preference",
        searchText: "open_with",
      });
      this.preferences = 'github';
      this.updateUI();
    }
    
    return Promise.resolve();
  }
}

expose(new NostrOpenSpecificNip());