
interface GResults {
    items: { link: string, title: string, snippet: string }[]
}

const toolsParseList = {
    webSearch: (tool: { name: string, data: { searchQuery: string, results: GResults } }): string => {        
        let html = `<div class="web-search-info">
        <strong>Searching web for "${tool.data.searchQuery}"...</strong>`;

        html += `<p class="web-search-result">
                ${tool.data.results.items.length} results found</p>`;

        html += '</div>';        

        return html;
    },
    rag: (tool: { name: string, data: { fileList: string[] } }): string => {        
        let html = `<div class="rag-info">
        <strong>Searching knowledge base...</strong>`;
        html += `<ul>`

        for (const file of tool.data.fileList) {
            html += `<li>${file}</li>`;
        }

        html += '</ul></div>';        

        return html;
    }
}


export const parseTool = (tool: { name: string, data: Record<string, any> }): string => {
    if (!toolsParseList[tool.name]) {
        return '';
    }
    return `<div class="tool-entry">
          <div class="tool-name">Tool: ${tool.name}</div>
          <div class="tool-info">${toolsParseList[tool.name](tool)}</div>
        </div>`;
}