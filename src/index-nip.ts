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
}

class NostrOpenSpecificNip extends TemplateUiCommand {
  private nips: Nip[] = [];
  private preferences: string = "";
  private loading: boolean = false;
  private searchQuery: string = "";

  async load() {
    this.loading = true;
    this.updateUI();
    try {
      // Fetch NIPs
      this.nips = await this.fetchNostrNips();
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
          content: `NIP-${formattedNipId}: ${title}`
        });
      }
      
      // Sort NIPs: numeric ones first (sorted by number), then alphanumeric (sorted alphabetically)
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
    } catch (error) {
      console.error('Error fetching NIPs:', error);
      return [];
    }
  }

  // Filter NIPs based on search query
  getFilteredNips(): Nip[] {
    if (!this.searchQuery) {
      return this.nips;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.nips.filter(nip => 
      nip.rawTitle.toLowerCase().includes(query) || 
      nip.nip.toLowerCase().includes(query) ||
      nip.content.toLowerCase().includes(query)
    );
  }

  // Handle search input change
  async onSearchTermChange(query: string): Promise<void> {
    this.searchQuery = query;
    this.updateUI();
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
    console.log('updateUI', this.preferences);
    return ui
      .setSearchBarPlaceholder("Number, Title, k[X], t[X]…")
      .then(() => {
        const filteredNips = this.getFilteredNips();

        if (this.loading) {
          return ui.render(new List.List({
            sections: [
              new List.Section({
                title: "Loading...",
                items: []
              })
            ]
          }));
        }

        if (filteredNips.length === 0) {
          return ui.render(new List.List({
            sections: [
              new List.Section({
                title: "No NIPs found",
                items: []
              })
            ]
          }));
        }

        return ui.render(
          new List.List({
            sections: [
              new List.Section({
                title: "Nostr Implementation Possibilities",
                items: filteredNips.map(
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