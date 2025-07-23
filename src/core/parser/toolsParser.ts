
interface GResults {
     items: { link: string, title: string, snippet: string }[] 
}

const toolsParseList = {
    webSearch: (tool: { name: string, data: { searchQuery: string, results: GResults }}): string => {
        console.log({tool})
        let html = `<div class="web-search-info">
        <strong>Searching web for "${tool.data.searchQuery}"...</strong>`;

        html+= `<p class="web-search-result">
                ${tool.data.results.items.length} results found</p>`;            

        html += '</div>';

        console.log(html);

        return html;
    }
}


export const parseTool = (tool: { name: string, data:  Record<string, any>} ): string => {
    return toolsParseList[tool.name]
        ? toolsParseList[tool.name](tool)
        : ``;
}