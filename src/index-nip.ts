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
      
      // Regular expression to match NIP entries in the list
      // Format is like: - [NIP-01: Basic protocol flow description](01.md)
      const nipRegex = /\- \[NIP-(\d+)\: (.*?)\]\((\d+\.md)\)/g;
      
      const nips: Nip[] = [];
      let match;
      
      // Find all matches in the content
      while ((match = nipRegex.exec(content)) !== null) {
        const nipNumber = match[1].padStart(2, '0'); // Pad to ensure consistent format like "01"
        const nipNumberNoPad = parseInt(nipNumber); // remove leading zeros
        const title = match[2];
        const filename = match[3];
        
        nips.push({
          nip: nipNumber,
          title: title,
          rawTitle: title, // Store raw title without formatting
          urlGithub: `https://github.com/nostr-protocol/nips/blob/master/${filename}`,
          urlNostrCom: `https://nips.nostr.com/${nipNumberNoPad}`,
          // We include content for filtering
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

  // Filter NIPs based on search query
  getFilteredNips(): Nip[] {
    if (!this.searchQuery) {
      return this.nips;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.nips.filter(nip => 
      nip.rawTitle.toLowerCase().includes(query) || 
      nip.nip.includes(query) ||
      nip.content.toLowerCase().includes(query)
    );
  }

  // Handle search input change
  async onSearchTermChange(query: string): Promise<void> {
    this.searchQuery = query;
    this.updateUI();
  }

  // Create action panel for the footer
  getFooterActions(): Action[] {
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
      .setSearchBarPlaceholder("Search NIPs by number or title… or k[X] 🥳")
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