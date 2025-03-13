/**
 * Kunkun Extension to display a searchable list of random words
 * Clicking an item logs it to the console
 */
import { TemplateUiCommand, expose, List, ui } from "@kksh/api/ui/template";

// List of random words
const randomWords = [
  "apple", "banana", "cherry", "date", "elderberry", 
  "fig", "grape", "honeydew", "kiwi", "lemon", 
  "mango", "nectarine", "orange", "pear", "quince", 
  "raspberry", "strawberry", "tangerine", "watermelon", "zucchini"
];

class RandomWordsExtension extends TemplateUiCommand {
  private filteredWords: string[] = [];
  public searchTerm: string = "";

  async load() {
    // Initialize with all words
    this.filteredWords = [...randomWords];
    // Set a custom placeholder for the search bar
    await ui.setSearchBarPlaceholder("Type to NOT filter (demonstration)");
    await this.updateUI();
    return;
  }

  async onSearchTermChange(term: string) {
    // Store the search term
    this.searchTerm = term;
    
    // Clear any automatic filtering by setting filtered to ALL words
    this.filteredWords = [...randomWords];
    
    // Add a prefix to show we're handling the search
    this.filteredWords = this.filteredWords.map(word => 
      `${term ? "🔍 " : ""}${word}`
    );
    
    // Log the search term for debugging
    console.log(`Search term "${term}" received and explicitly ignored`);
    
    // Complete bypass of the default filtering by doing full UI update
    await this.updateUI();
    return;
  }

  async onListItemSelected(value: string) {
    // Log the selected word to the console
    console.log(`Selected word: ${value}`);
    return;
  }

  // Use the updateUI pattern from the more complex implementation
  private async updateUI() {
    // Create list items using the proper List API
    const listItems = this.filteredWords.map(word => 
      new List.Item({
        title: word,
        subTitle: this.searchTerm ? 
          `Search term: "${this.searchTerm}" is being ignored` : 
          `No filtering applied`,
        value: word
      })
    );
    
    // Create a list with the items
    const listView = new List.List({
      items: listItems
    });
    
    // Render the list using the proper UI API
    await ui.render(listView);
  }
}

// Expose the extension
expose(new RandomWordsExtension());
