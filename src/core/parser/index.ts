import { ReactiveControllerHost } from 'lit';
import { ChatResponseError, newListWithEntryAtIndex } from '../../utils/index.js';
import { createReader, readStream } from '../stream/index.js';
import { createBufferState, processChunkWithBuffering } from './bufferer.js';
import voucher_codes from 'voucher-code-generator';
import { parseTool } from './toolsParser.js';

export async function parseStreamedMessages({
  chatEntry,
  apiResponseBody,
  signal,
  onChunkRead: onVisit,
  onCancel,  
}: {
  chatEntry: ChatThreadEntry;
  apiResponseBody: ReadableStream<Uint8Array> | null;
  signal: AbortSignal;
  onChunkRead: (updated: ChatThreadEntry) => void;
  onCancel: () => void;  
}, host: ReactiveControllerHost) {
  const reader = createReader(apiResponseBody);
  const chunks = readStream<BotResponseChunk | BotResponseError>(reader);
  let startedCoding = false;
  let coderId = null;
  let citations: Citation[] = [];
  const streamedMessageRaw: string[] = [];
  const bufferState = createBufferState();
  let textBlockIndex = 0;

  let updatedEntry = {
    ...chatEntry,
  };

  for await (const chunk of chunks) {
    if (signal.aborted) {
      onCancel();
      return;
    }

    if ('error' in chunk) {
      throw new ChatResponseError(chunk.message, chunk.statusCode);
    }

    if(chunk.conversationId) {
        const event = new CustomEvent('chat:conversation:start', {
        detail: { conversationId: chunk.conversationId },
        bubbles: true,
        composed: true
      });
      (host as any).dispatchEvent(event);   
      continue;
    }    

     if(chunk.tool) {  
      try {
        updatedEntry = updateTextEntry({ chunkValue: parseTool(chunk.tool), textBlockIndex, chatEntry: updatedEntry });      
        onVisit(updatedEntry);
      }catch(e){
        console.log(e)
      }
       
        continue;
    }   

    if(chunk.citations) {
      citations = [ ...citations, ...chunk.citations ];      
      continue;
    }

    // content is filtered during the output streaming
    // https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/content-filter?tabs=javascrit
    if (chunk.choices[0].finish_reason === 'content_filter') {
      throw new ChatResponseError('Content filtered', 400);
    }

    const { content, context } = chunk.choices[0].delta;
    if (context?.data_points) {
      updatedEntry.dataPoints = context.data_points ?? [];
      updatedEntry.thoughts = context.thoughts ?? '';

      continue;
    }
    let chunkValue = content ?? '';

    if (chunkValue === '') {
      continue;
    }

    streamedMessageRaw.push(chunkValue);      

    // Process chunk with buffering
    const { processedChunk, bufferState: updatedBufferState } = processChunkWithBuffering(chunkValue, bufferState, (bufferInfo, chunk) => {
      if(bufferInfo.buffering && bufferInfo.bufferingClosure === '```') {   
        const hoster = (host as any);
        try {
          const codeViewer: { updateRenderer: (text: string) => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[id="'+coderId+'"]');
          if(codeViewer){            
            codeViewer.updateRenderer(chunk);     
          }    
        } catch(e){
          console.error(e);
        }      
      }
    });  
    
    // Only update text entry when we have a processed chunk (either normal or completed buffering)
    if (processedChunk !== null) {
      if(startedCoding){
        coderId = null;
        startedCoding = false;      
      }else{        
        updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
      }
    }else{
      if(updatedBufferState.buffering && !startedCoding && updatedBufferState.bufferText.includes('\n')){
        startedCoding = true;
        coderId = voucher_codes.generate({
          length: 10,
          count: 1,
          charset: 'alphanumeric',
        })[0].toLowerCase();       
        
        updatedEntry = updateTextEntry({ chunkValue: '<code-viewer id="'+coderId+'">'+updatedBufferState.bufferText+'```</code-viewer>', textBlockIndex, chatEntry: updatedEntry });
      }    
    }
    
    updatedEntry = updateCitationsEntry({ citations: [], chatEntry: updatedEntry });

    onVisit(updatedEntry);
  }

  updatedEntry = updateCitationsEntry({ citations, chatEntry: updatedEntry });

    onVisit(updatedEntry);
}

// update the citations entry and wrap the citations in a sup tag
export function updateCitationsEntry({
  citations,
  chatEntry,
}: {
  citations: Citation[];
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  const lastMessageEntry = chatEntry;
  const updateCitationReference = (match, capture) => {
    const citation = citations.find((citation) => citation.text === capture);
    if (citation) {
      return `<sup class="citation">${citation.ref}</sup>`;
    }
    return match;
  };

  const textEntrys = lastMessageEntry.text.map((textEntry) => {
    const value = textEntry.value.replaceAll(/\[(.*?)]/g, updateCitationReference);
    const followingSteps = textEntry.followingSteps?.map((step) =>
      step.replaceAll(/\[(.*?)]/g, updateCitationReference),
    );
    return {
      value,
      followingSteps,
    };
  });

  return {
    ...lastMessageEntry,
    text: textEntrys,
    citations,
  };
}

// parse and format citations
export function parseCitations(inputText: string): Citation[] {
  const findCitations = /\[(.*?)]/g;
  const citation: NonNullable<unknown> = {};
  let referenceCounter = 1;

  // extract citation (filename) from the text and map it to a reference number
  inputText.replaceAll(findCitations, (_, capture) => {
    const citationText = capture.trim();
    if (!citation[citationText]) {
      citation[citationText] = referenceCounter++;
    }
    return '';
  });

  return Object.keys(citation).map((text, index) => ({
    ref: index + 1,
    text,
  }));
}

// update the text block entry
export function updateTextEntry({
  chunkValue,
  textBlockIndex,
  chatEntry,
}: {
  chunkValue: string;
  textBlockIndex: number;
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  const { text: lastChatMessageTextEntry } = chatEntry;
  const block = lastChatMessageTextEntry[textBlockIndex] ?? {
    value: '',
    followingSteps: [],
  };

  const value = (block.value || '') + chunkValue;

  return {
    ...chatEntry,
    text: newListWithEntryAtIndex(lastChatMessageTextEntry, textBlockIndex, {
      ...block,
      value,
    }),
  };
}

// update the following steps or followup questions entry
export function updateFollowingStepOrFollowupQuestionEntry({
  chunkValue,
  textBlockIndex,
  stepIndex,  
  chatEntry,
}: {
  chunkValue: string;
  textBlockIndex: number;
  stepIndex: number;  
  chatEntry: ChatThreadEntry;
}): ChatThreadEntry {
  // following steps and followup questions are treated the same way. They are just stored in different arrays
  const { text: lastChatMessageTextEntry } = chatEntry;
  if (lastChatMessageTextEntry && lastChatMessageTextEntry[textBlockIndex]) {
    const { followingSteps } = lastChatMessageTextEntry[textBlockIndex];
    if (followingSteps) {
      const step = (followingSteps[stepIndex] || '') + chunkValue;
      return {
        ...chatEntry,
        text: newListWithEntryAtIndex(lastChatMessageTextEntry, textBlockIndex, {
          ...lastChatMessageTextEntry[textBlockIndex],
          followingSteps: newListWithEntryAtIndex(followingSteps, stepIndex, step),
        }),
      };
    }
  }

  return chatEntry;
}
