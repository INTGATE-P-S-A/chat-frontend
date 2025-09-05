import { ReactiveControllerHost } from 'lit';
import { ChatResponseError, newListWithEntryAtIndex } from '../../utils/index.js';
import { createReader, readStream } from '../stream/index.js';
import { createBufferState, processChunkWithBuffering } from './bufferer.js';
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
  let coderId: string | null = null;
  let codeViewerCreated = false; // Track if we've already created the code-viewer
  let codeGenerationStopped = false; // Track if we've already stopped code generation
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

    if(chunk.progress && chunk.status !== 'rws_progress'){
      continue;
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
      } catch(e) {
        // Handle error silently or add proper error handling if needed
      }
       
        continue;
    }   

    if(chunk.citations) {
      citations = [ ...citations, ...chunk.citations ];      
      continue;
    }

    // Handle rws_progress status for progress updates
    if (chunk.status === 'rws_progress') {
      if (chunk.progress) {
        const progress = chunk.progress as ProgressChunk;

        // Dispatch progress event to chat component
        const event = new CustomEvent('chat:progress', {
          detail: {
            stage: progress.stage || '',
            message: progress.message || '',
            percentage: progress.details?.percentage || 0,
            details: progress.details
          },
          bubbles: true,
          composed: true
        });
        (host as any).dispatchEvent(event);
      }
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

    // Store previous buffering state to detect completion
    const wasBufferingCodeViewer = bufferState.buffering && bufferState.currentRule === 'code-block';


    // Process chunk with buffering
    const { processedChunk, bufferState: updatedBufferState } = processChunkWithBuffering(chunkValue, bufferState, (bufferInfo, chunk) => {
      // Update code-viewer if we're actively buffering a code-block
      if(bufferInfo.buffering && bufferInfo.currentRule === 'code-block' && coderId) {   
        const hoster = (host as any);
        try {
          const codeViewer: { updateRenderer: (text: string) => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="'+coderId+'"]');
          if(codeViewer && typeof codeViewer.updateRenderer === 'function'){            
            codeViewer.updateRenderer(chunk);     
          }    
        } catch(e){
          console.error('Error updating code-viewer:', e);
        }      
      }
    });

    // Check if code-viewer buffering just completed
    const codeViewerJustCompleted = wasBufferingCodeViewer && !updatedBufferState.buffering && startedCoding;
    
    if(codeViewerJustCompleted) {
      // Stop code generation immediately when buffering completes
      try {
        const hoster = (host as any);
        const codeViewer: { stopCodeGeneration: () => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="'+coderId+'"]');
        if(codeViewer && typeof codeViewer.stopCodeGeneration === 'function'){            
          codeViewer.stopCodeGeneration();     
          codeGenerationStopped = true; // Mark that we've stopped generation
        }    
      } catch(e){
        console.error('Error stopping code generation:', e);
      }
    }  
    
    // Check if we're currently streaming to a code-viewer
    const isStreamingToCodeViewer = updatedBufferState.buffering && 
                                   updatedBufferState.currentRule === 'code-block' && 
                                   startedCoding;
    
    // Only update text entry when we have a processed chunk AND we're not streaming to code-viewer
    // AND we haven't already stopped code generation (to prevent post-completion updates)
    if (processedChunk !== null && !isStreamingToCodeViewer && !codeGenerationStopped) {
      // Check if this chunk contains a new code-viewer tag being created
      if(processedChunk.includes('<code-viewer') && !startedCoding && !codeViewerCreated) {
        startedCoding = true;
        codeViewerCreated = true; // Mark that we've created the component
        
        // Extract the componentId from the generated code-viewer tag
        const componentIdMatch = processedChunk.match(/componentId="([^"]+)"/);
        if(componentIdMatch) {
          coderId = componentIdMatch[1];
          
          // Start code generation on the code-viewer component after a small delay
          setTimeout(() => {
            try {
              const hoster = (host as any);
              const codeViewer: { startCodeGeneration: () => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="'+coderId+'"]');
              if(codeViewer && typeof codeViewer.startCodeGeneration === 'function'){            
                codeViewer.startCodeGeneration();     
              }    
            } catch(e){
              console.error('Error starting code generation:', e);
            }
          }, 100); // Small delay to ensure component is rendered
        }
        
        // Add the code-viewer tag to DOM immediately - this creates the component ONCE
        updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
      } else if(processedChunk.includes('<code-viewer') && codeViewerCreated) {
        // If we already created a code-viewer and this chunk has another one, COMPLETELY IGNORE IT
        // Do nothing - don't add this chunk to prevent recreation
      } else if(!processedChunk.includes('<code-viewer')) {
        // Only add chunks that don't contain code-viewer tags
        updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
      }
      
      // Handle code-viewer completion (reset state)
      if(codeViewerJustCompleted){
        // Code-viewer just completed, reset state (stopCodeGeneration already called)
        coderId = null;
        startedCoding = false;
        // DON'T reset codeViewerCreated - once created, never recreate
      }
    }
    
    // Update buffer state for next iteration
    Object.assign(bufferState, updatedBufferState);
    
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
