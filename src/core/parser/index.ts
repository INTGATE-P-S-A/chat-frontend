import { ReactiveControllerHost } from 'lit';
import { ChatResponseError } from '../../utils/index.js';
import { createReader, readStream } from '../stream/index.js';
import { createBufferState, processChunkWithBuffering, parseText } from './bufferer.js';
import { parseTool } from './toolsParser.js';
import { ChatThreadComponent } from '../../components/chat-thread-component.js';
import { CitationListComponent } from '../../components/citation-list.js';
import { 
  createHtmlTagBufferState, 
  processChunkWithHtmlTagBuffering, 
  handleRemainingHtmlTagBuffer
} from './tags-close-detector.js';
import { updateTextEntry, updateCitationsEntry, updateToolsEntry } from './parser-functions.js';

function getCodeViewer(host: ReactiveControllerHost, coderId: string): { updateRenderer: (text: string) => void, endStream: () => void } {
  const hoster = (host as any);
  return hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="' + coderId + '"]');
}

// Helper function to extract text content from either string or MessageContent[]
function extractTextContent(content: string | MessageContent[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    // Find the first text content in the array
    const textContent = content.find(item => item.type === 'text');
    return textContent?.text || '';
  }
  
  return '';
}

export async function parseStreamedMessages({
  chatEntry,
  apiResponseBody,
  signal,
  onChunkRead: onVisit,
  onCancel,
  onReasoningStep,
}: {
  chatEntry: ChatThreadEntry;
  apiResponseBody: ReadableStream<Uint8Array> | null;
  signal: AbortSignal;
  onChunkRead: (updated: ChatThreadEntry) => void;
  onCancel: () => void;
  onReasoningStep?: (reasoningId: string, step: string) => void;
}, host: ReactiveControllerHost) {
  const reader = createReader(apiResponseBody);
  const chunks = readStream<BotResponseChunk | BotResponseError>(reader);
  let startedCoding = false;
  let coderId: string | null = null;
  let codeViewerCreated = false;
  let accumulatedCodeContent = ''; 
  let citations: Citation[] = [];
  const streamedMessageRaw: string[] = [];
  let rawContentAccumulator = ''; 
  const bufferState = createBufferState();
  let textBlockIndex = 0;
  
  // HTML tag buffering state
  let htmlTagBufferState = createHtmlTagBufferState();

  // Autotalk HTML tag stripping state
  let autoTalkInTag = false;
  let autoTalkSentenceBuffer = '';

  const flushAutoTalkBuffer = (_isFinal = false): string | null => {
    const remaining = autoTalkSentenceBuffer;
    autoTalkSentenceBuffer = '';
    autoTalkInTag = false;
    return remaining || null;
  };

  const processAutoTalkChunk = (chunk: string): string | null => {
    let text = chunk;

    // If the previous chunk ended inside an HTML tag, drop everything up to
    // the end of that tag ('>' or newline) in this chunk
    if (autoTalkInTag) {
      const gtIndex = text.indexOf('>');
      const nlIndex = text.indexOf('\n');
      let endIndex = -1;

      if (gtIndex !== -1 && nlIndex !== -1) {
        endIndex = Math.min(gtIndex, nlIndex);
      } else {
        endIndex = Math.max(gtIndex, nlIndex);
      }

      if (endIndex === -1) {
        // Still inside the tag; nothing to emit yet
        return null;
      }

      text = text.slice(endIndex + 1);
      autoTalkInTag = false;
    }

    // Strip complete HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // If a tag starts but doesn't finish in this chunk, drop the partial tag
    // (or cut it at a newline) and skip its continuation in the next chunk
    const ltIndex = text.lastIndexOf('<');
    if (ltIndex !== -1 && text.indexOf('>', ltIndex) === -1) {
      const nlIndex = text.indexOf('\n', ltIndex);
      if (nlIndex !== -1) {
        // Tag ends at the newline
        text = text.slice(0, ltIndex) + text.slice(nlIndex + 1);
      } else {
        // Partial tag continues into the next chunk
        text = text.slice(0, ltIndex);
        autoTalkInTag = true;
      }
    }

    if (!text) {
      return null;
    }

    autoTalkSentenceBuffer += text;

    // Emit only when we reach the end of a sentence (dot followed by
    // whitespace or end of buffered text)
    const sentenceEndMatch = autoTalkSentenceBuffer.match(/\.(\s|$)/);
    if (sentenceEndMatch) {
      const endIndex = sentenceEndMatch.index! + sentenceEndMatch[0].length;
      const sentence = autoTalkSentenceBuffer.slice(0, endIndex);
      autoTalkSentenceBuffer = autoTalkSentenceBuffer.slice(endIndex);
      return sentence;
    }

    return null;
  };

  let updatedEntry = {
    ...chatEntry,
  };

  const promptCost: IPromptCost = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost: 0,
    reasoning_tokens: 0
  }  

  let reasoningId: string | null = null;
  let currentRequestId: string | null = null;

  for await (const chunk of chunks) {
    if (signal.aborted) {
      onCancel();
      return;
    }

    if ((chunk as BotResponseChunk).cost) {
      promptCost.prompt_tokens += (chunk as BotResponseChunk).cost?.prompt_tokens || 0;
      promptCost.completion_tokens += (chunk as BotResponseChunk).cost?.completion_tokens || 0;
      promptCost.total_tokens += (chunk as BotResponseChunk).cost?.total_tokens || 0;
      promptCost.cost += (chunk as BotResponseChunk).cost?.cost || 0;
      promptCost.reasoning_tokens += (chunk as BotResponseChunk).cost?.reasoning_tokens || 0;

      updatedEntry = {
        ...updatedEntry,
        cost: promptCost
      };
      onVisit(updatedEntry);
            
      (host as any).dispatchEvent(new CustomEvent('credit:balance:updated', {
        bubbles: true,
        composed: true
      }));
      
      continue;
    }

    if ('error' in chunk) {
      throw new ChatResponseError(chunk.message, chunk.statusCode);
    }

    if (chunk.progress && chunk.status !== 'rws_progress') {
      continue;
    }

    if (chunk.conversationId) {
      const event = new CustomEvent('chat:conversation:start', {
        detail: { 
          conversationId: chunk.conversationId,
          conversationUid: (chunk as any).conversationUid 
        },
        bubbles: true,
        composed: true
      });
      (host as any).dispatchEvent(event);
      continue;
    }

    if ((chunk as any).requestId) {
      currentRequestId = (chunk as any).requestId;
      const event = new CustomEvent('chat:request:id', {
        detail: { requestId: currentRequestId },
        bubbles: true,
        composed: true
      });
      (host as any).dispatchEvent(event);
      continue;
    }

    if (chunk.reasoning) {
      if (!reasoningId) {
        reasoningId = 'reasoning-' + Math.random().toString(36).substring(2, 15);
      }
      
      if (onReasoningStep) {
        const reasonongBufferState = createBufferState();
        const processedReasoning = processChunkWithBuffering(parseText(chunk.reasoning as string, { mode: 'full' }), reasonongBufferState);
        onReasoningStep(reasoningId, processedReasoning.processedChunk as string);
      }
      
      continue;
    }

    if (chunk.tool) {
      try {
        updatedEntry = updateToolsEntry({ tool: chunk.tool, chatEntry: updatedEntry });
        onVisit(updatedEntry);
        (host as any).dispatchEvent(new CustomEvent('chat:tool:detected', {
          bubbles: true,
          composed: true,
          detail: { tool: chunk.tool }
        }));
      } catch (e) {
        // Error parsing tool chunk
      }

      continue;
    }

    if (chunk.citations) {
      citations = [...citations, ...chunk.citations];
      continue;
    }

    if (chunk.status === 'rws_progress') {
      if (chunk.progress) {
        const progress = chunk.progress as ProgressChunk;

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
    let chunkValue = extractTextContent(content ?? '');

    if (chunkValue === '') {
      continue;
    }    

    rawContentAccumulator += chunkValue;    

    streamedMessageRaw.push(chunkValue);

    if((host as any).autoTalkEnabled){
      const eventChunkValue = processAutoTalkChunk(chunkValue);
      if (eventChunkValue !== null) {
        (host as any).dispatchEvent(new CustomEvent('autotalk:stream-chunk', {
          detail: { chunk: eventChunkValue, isFinal: false },
          bubbles: true,
          composed: true
        }));       
      }
    }
    
    const { finalChunkValue, shouldSkip, bufferState: updatedHtmlBufferState } = processChunkWithHtmlTagBuffering(chunkValue, htmlTagBufferState);
    htmlTagBufferState = updatedHtmlBufferState;
    
    if (shouldSkip) {
      continue; 
    }

    const wasBufferingCodeViewer = bufferState.buffering && bufferState.currentRule === 'code-block';

    const { processedChunk, bufferState: updatedBufferState } = processChunkWithBuffering(finalChunkValue, bufferState, (bufferInfo, chunk) => {
      if (bufferInfo.buffering && bufferInfo.currentRule === 'code-block' && coderId) {              
        getCodeViewer(host, coderId)?.updateRenderer(chunk);
      } else if (bufferInfo.currentRule === 'code-block' && coderId) {        
        getCodeViewer(host, coderId)?.updateRenderer(chunk);
      } else if (wasBufferingCodeViewer && coderId) {        
        getCodeViewer(host, coderId)?.updateRenderer(chunk);
      }
    });

    const codeViewerJustCompleted = wasBufferingCodeViewer && !updatedBufferState.buffering && startedCoding;

    if (codeViewerJustCompleted) {
      try {
        const hoster = (host as any);
        const codeViewer: { stopCodeGeneration: () => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="' + coderId + '"]');

        if (codeViewer && typeof codeViewer.stopCodeGeneration === 'function') {                  
          codeViewer.stopCodeGeneration();
        }
      } catch (e) {
        // Error stopping code generation
      }
      
      // Reset variables for next code block
      startedCoding = false;
      coderId = null;
      codeViewerCreated = false;
    }

    const isStreamingToCodeViewer = updatedBufferState.buffering &&
      updatedBufferState.currentRule === 'code-block' &&
      startedCoding;

    if (processedChunk !== null && !isStreamingToCodeViewer) {
      if (processedChunk.includes('<code-viewer') && !startedCoding) {
        startedCoding = true;
        codeViewerCreated = true; 

        const componentIdMatch = processedChunk.match(/componentId="([^"]+)"/);
        if (componentIdMatch) {
          coderId = componentIdMatch[1];

          // Use requestAnimationFrame instead of setTimeout for faster execution
          requestAnimationFrame(() => {
            try {
              const hoster = (host as any);
              const codeViewer: { startCodeGeneration: () => void } = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector('code-viewer[componentId="' + coderId + '"]');
              if (codeViewer && typeof codeViewer.startCodeGeneration === 'function') {
                codeViewer.startCodeGeneration();
              }
            } catch (e) {
              // Error starting code generation
            }
          }); 
        }
      }

      updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
    }

    Object.assign(bufferState, updatedBufferState);

    updatedEntry = updateCitationsEntry({ citations: [], chatEntry: updatedEntry });

    onVisit(updatedEntry);
  }

  // Handle any remaining buffered HTML tag content
  const { hasRemainingContent, remainingContent } = handleRemainingHtmlTagBuffer(htmlTagBufferState);
  if (hasRemainingContent) {
    const { processedChunk } = processChunkWithBuffering(remainingContent, bufferState);
    if (processedChunk !== null) {
      updatedEntry = updateTextEntry({ chunkValue: processedChunk, textBlockIndex, chatEntry: updatedEntry });
    }
  }

  // Flush any remaining autotalk buffered content
  if ((host as any).autoTalkEnabled) {
    const finalAutoTalkChunk = flushAutoTalkBuffer(true);
    if (finalAutoTalkChunk !== null) {
      (host as any).dispatchEvent(new CustomEvent('autotalk:stream-chunk', {
        detail: { chunk: finalAutoTalkChunk, isFinal: true },
        bubbles: true,
        composed: true
      }));
    }
  }

  updatedEntry = updateCitationsEntry({ citations, chatEntry: updatedEntry });

  // Set the accumulated raw content
  updatedEntry.rawContent = rawContentAccumulator;

  // FINAL STEP: If we accumulated code content, update the last rendered code-viewer
  if (accumulatedCodeContent && codeViewerCreated) {
    setTimeout(() => {
      try {
        const hoster = (host as any);
        // Find the last code-viewer in the current message using the stored coderId
        let codeViewer: { updateRenderer: (text: string) => void } | null = null;

        if (coderId) {
          // Try to find by specific componentId first
          codeViewer = hoster.renderRoot?.querySelector('chat-thread-component').renderRoot?.querySelector(`code-viewer[componentId="${coderId}"]`);
        }

        if (!codeViewer) {
          // Fallback: find last code-viewer in the message
          codeViewer = hoster.renderRoot?.querySelector('chat-thread-component .message:last-child code-viewer:last-of-type');
        }

        if (codeViewer && typeof codeViewer.updateRenderer === 'function') {          
          // codeViewer.updateRenderer(accumulatedCodeContent);

          // Clear state after successful update
          accumulatedCodeContent = '';
          coderId = null;
        }
      } catch (e) {
        // Error updating code-viewer with accumulated content
      }
    }, 500); // Longer delay to ensure DOM is fully rendered
  }

  onVisit(updatedEntry);

  if(citations.length){
    setTimeout(() => {
      const thread: ChatThreadComponent | null = ((host as any).renderRoot as ShadowRoot)?.querySelector('chat-thread-component');
      const refs = thread?.shadowRoot?.querySelectorAll('.search-ref');

      if(refs && refs.length){
        const parentMsg = refs[0].closest('.chat__txt ');

        let i = 0;
        for (const ref of refs) {
          ref.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            const number = target.innerText.replace('[', '').replace(']', '');
            const index = parseInt(number, 10) - 1;

            const citationList = parentMsg?.querySelector('citation-list') as CitationListComponent;
            
            citationList.highlight(index);

            thread?.scrollToBottom(true);            
          });
          i++; 
        }        
      }
    }, 500);    
  }
  
  reasoningId = null;
}
