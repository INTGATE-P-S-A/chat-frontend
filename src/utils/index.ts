// Util functions to process text from response, clean it up and style it
// We keep it in this util file because we may not need it once we introduce
// a new response format with TypeChat or a similar component

import { LitElement } from "lit";

// Let's give the response a type so we can use it in the component

export function processText(inputText: string, arrays: Array<Array<string> | Array<Citation>>): ProcessTextReturn {  
  // Keeping all the regex at this level so they can be easily changed or removed
  const nextQuestionMatch = `Next questions:|<<([^>]+)>>`;
  const findCitations = /\[(.*?)]/g;
  const findFollowingSteps = /:([\s\S]*?)(?:Follow-up questions:|Next questions:|<<|$)/;
  const findDashListItems = /^-\s*(.+)\n/gm;
  const findNextQuestions = /Next Questions:(.*?)$/s;
  const findQuestionsbyDoubleArrow = /<<([^<>]+)>>/g;
  
  // Find and process citations
  const citation: NonNullable<unknown> = {};
  let citations: Citation[] = [];
  let referenceCounter = 1;
  // eslint-disable-next-line unicorn/prefer-string-replace-all
  let replacedText = inputText.replace(findCitations, (_match, capture) => {
    const citationText = capture.trim();
    if (!citation[citationText]) {
      citation[citationText] = referenceCounter++;
    }
    return `<sup class="citation">${citation[citationText]}</sup>`;
  });
  citations = Object.keys(citation).map((text, index) => ({
    ref: index + 1,
    text,
  }));
  arrays[0] = citations;

  // Because the format for followup questions is inconsistent
  // and sometimes it includes a Next Questions prefix, we need  do some extra work
  const hasNextQuestions = replacedText.includes(nextQuestionMatch);
  // Find and store 'follow this steps' portion of the response
  // considering the fact that sometimes the 'next questions' indicator is present
  // and sometimes it's not
  const followingStepsMatch = replacedText.match(findFollowingSteps);
  const followingStepsText = followingStepsMatch ? followingStepsMatch[1].trim() : '';
  
  // Extract only dash-formatted list items
  const dashItems = followingStepsText.match(findDashListItems) || [];
  const cleanFollowingSteps = dashItems.map((item) => {
    return item.replace(/^-\s*/, ''); // Remove the dash and any following whitespace
  });
  arrays[1] = cleanFollowingSteps;

  // Determine which regex to use, depending if the indicator is present
  const nextRegex = hasNextQuestions ? findNextQuestions : findQuestionsbyDoubleArrow;
  const nextQuestionsMatch = replacedText.match(nextRegex) ?? [];
  let nextQuestions: string[] = [];
  nextQuestions = cleanUpFollowUp([...(nextQuestionsMatch as string[])]);

  // Remove the 'steps', 'citation' and 'next questions' portions of the response
  // from the response answer
  const stepsIndex = replacedText.indexOf('s:');
  // eslint-disable-next-line unicorn/no-negated-condition, unicorn/prefer-string-slice
  replacedText = stepsIndex !== -1 ? inputText.substring(0, stepsIndex + 6) : inputText;

  arrays[2] = nextQuestions;
  return { replacedText, arrays };
}

// Clean up responses with << and >>
export function cleanUpFollowUp(followUpList: string[]): string[] {
  if (followUpList && followUpList.length > 0 && followUpList[0].startsWith('<<')) {
    followUpList = followUpList.map((followUp) => followUp.replace('<<', '').replace('>>', ''));
  }
  return followUpList;
}

// Get the current timestamp to display with the chat message
export function getTimestamp() {
  return new Date().getTime();
}

export function chatEntryToString(entry: ChatThreadEntry) {  
  const message = entry.text
    .map((textEntry) => {
      let result = textEntry.value;
      if (textEntry.followingSteps && textEntry.followingSteps.length > 0) {
        result += '\n\n' + textEntry.followingSteps.map((s, i) => `${i + 1}.` + s).join('\n');
      }
      return result;
    })
    .join('\n\n')
    .replaceAll(/<br\s*\/?>/gi, '\n') // convert <br/> tags to newlines
    .replace(/<code-viewer[^>]*>([\s\S]*?)<\/code-viewer>/gi, (match, content) => {
      // Preserve code-viewer content but strip HTML from it
      return content.replace(/<[^>]*>/g, '');
    })
    .replaceAll(/<[^>]*>/g, ''); // remove all remaining HTML tags

  return message;
}

export function chatEntryToHtmlString(entry: ChatThreadEntry) {
  const message = entry.text
    .map((textEntry) => {
      let result = textEntry.value;
      if (textEntry.followingSteps && textEntry.followingSteps.length > 0) {
        result += '<br><br>' + textEntry.followingSteps.map((s, i) => `${i + 1}. ${s}`).join('<br>');
      }
      return result;
    })
    .join('<br><br>')
    // Remove specific RWS-component tags while preserving standard HTML formatting
    .replace(/<rws-tools[^>]*>[\s\S]*?<\/rws-tools>/gi, '') // Remove RWS tools
    .replace(/<share-window[^>]*>[\s\S]*?<\/share-window>/gi, '') // Remove share windows  
    .replace(/<loading-indicator[^>]*>[\s\S]*?<\/loading-indicator>/gi, '') // Remove loading indicators
    .replace(/<citation-list[^>]*>[\s\S]*?<\/citation-list>/gi, '') // Remove citation lists
    .replace(/<document-previewer[^>]*>[\s\S]*?<\/document-previewer>/gi, '') // Remove document previewers
    .replace(/<teaser-list-component[^>]*>[\s\S]*?<\/teaser-list-component>/gi, '') // Remove teaser lists
    .replace(/<tab-component[^>]*>[\s\S]*?<\/tab-component>/gi, '') // Remove tab components
    .replace(/<reasoning-viewer[^>]*>[\s\S]*?<\/reasoning-viewer>/gi, '') // Remove reasoning viewers
    .replace(/<progress-bar[^>]*>[\s\S]*?<\/progress-bar>/gi, '') // Remove progress bars
    .replace(/<voice-input-button[^>]*>[\s\S]*?<\/voice-input-button>/gi, '') // Remove voice input buttons
    .replace(/<chat-action-button[^>]*>[\s\S]*?<\/chat-action-button>/gi, '') // Remove action buttons
    .replace(/<chat-thread-component[^>]*>[\s\S]*?<\/chat-thread-component>/gi, '') // Remove chat thread components
    .replace(/<chat-component[^>]*>[\s\S]*?<\/chat-component>/gi, '') // Remove chat components
    .replace(/<chat-stage[^>]*>[\s\S]*?<\/chat-stage>/gi, '') // Remove chat stage components
    .replace(/<link-icon[^>]*>[\s\S]*?<\/link-icon>/gi, '') // Remove link icons
    .replace(/<code-viewer[^>]*>([\s\S]*?)<\/code-viewer>/gi, (match, content) => {
      // Convert code-viewer to simple <pre><code> tags, preserving inner formatting
      return `<pre><code>${content}</code></pre>`;
    })
    // Remove file-tag related elements
    .replace(/<file-tag[^>]*>[\s\S]*?<\/file-tag>/gi, '')
    .replace(/<file-[a-z-]+[^>]*>[\s\S]*?<\/file-[a-z-]+>/gi, '') // Remove any file-* components
    // Remove self-closing RWS components 
    .replace(/<(rws-tools|share-window|loading-indicator|citation-list|document-previewer|teaser-list-component|tab-component|reasoning-viewer|progress-bar|voice-input-button|chat-action-button|link-icon|file-tag|file-[a-z-]+)[^>]*\/>/gi, '');

  return message;
}

// Creates a new chat message error
export class ChatResponseError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}

export function newListWithEntryAtIndex<T>(list: T[], index: number, entry: T) {
  return [...list.slice(0, index), entry, ...list.slice(index + 1)];
}


export async function addIconSheet(this: LitElement) {
    if(this.shadowRoot){
      const simpleIconsText = await fetch('/assets/css/simple-line-icons.css').then(res => res.text());

      const simpleIconsSheet = new CSSStyleSheet();
      await simpleIconsSheet.replace(simpleIconsText);

      const iconsmindsText = await fetch('/assets/css/iconsminds.css').then(res => res.text());

      const iconsmindsSheet = new CSSStyleSheet();
      await iconsmindsSheet.replace(iconsmindsText);

      this.shadowRoot.adoptedStyleSheets = [
        simpleIconsSheet,
        iconsmindsSheet,
        ...this.shadowRoot.adoptedStyleSheets,
      ];      
    }    
}