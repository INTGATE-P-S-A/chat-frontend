import { LitElement, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import { styles } from '../styles/chat-thread-component.js';

import { globalConfig } from '../config/global-config.js';
import { addIconSheet, chatEntryToString, chatEntryToHtmlString } from '../utils/index.js';

import './citation-list.js';
import './chat-action-button.js';
import './loading-indicator.js';
import './reasoning-viewer.js';
import { type ChatActionButton } from './chat-action-button.js';
import { RenderThreadHelper } from '../helpers/RenderThreadHelper.js';

let currentConfig = globalConfig;

@customElement('chat-thread-component')
export class ChatThreadComponent extends LitElement {
  static override styles = [styles];

  @property({ type: Array })
  chatThread: ChatThreadEntry[] = [];

  @property({ type: Array })
  actionButtons: ChatActionButton[] = [];

  @property({ type: Boolean })
  isDisabled = false;

  @property({ type: Boolean })
  isProcessingResponse = false;

  @property({ type: Boolean })
  showInitialMessagesReasoningClosed = true;

  @property({ type: String })
  conversationTitle;

  @property({ type: String })
  conversationUid;
  
  @property({ type: Boolean })
  isFullscreen = false;

  @property({ type: Object })
  customConfig: Record<string, string> = {};

  @state()
  isResponseCopied = false;

  @state()
  isReasoningClosed = false;

  @state()
  aiAssistantSignal: IExternalAssistSignal | null = null;

  @query('#chat-list-footer')
  chatFooter!: HTMLElement;

  @property({ type: Number })
  private isTalking: 0 | 1 | 2 = 0;

  @property({ type: Boolean })
  private upperLoader = false;

  @state()
  private isUserScrolledUp = false;

  private scrollTimeout: any = null;

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();     
    
    // Override config if customConfig is provided
    this.overrideConfig();
    
    // Set up scroll listener after component is rendered
    this.updateComplete.then(() => {
      this.setupScrollListener();
    });

    // Listen for code-viewer close others events
    this.addEventListener('code-viewer:close-others', this.handleCloseOtherCodeViewers.bind(this) as EventListener);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeScrollListener();
    
    // Remove code-viewer event listener
    this.removeEventListener('code-viewer:close-others', this.handleCloseOtherCodeViewers.bind(this) as EventListener);
  }

  private setupScrollListener(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
      
      // Initialize scroll state based on current position
      const threshold = 10;
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
      this.isUserScrolledUp = !isAtBottom;
    }
  }

  private removeScrollListener(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', this.handleScroll.bind(this));
    }
  }

  private handleScroll(event: Event): void {
    const scrollContainer = event.target as HTMLElement;
    const threshold = 10;
    
    const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
    
    // Clear any pending scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // During streaming, immediately detect if user scrolls up
    if (this.isProcessingResponse && !isAtBottom) {
      this.isUserScrolledUp = true;
      return;
    }
    
    // Set a timeout for non-streaming scenarios or when user scrolls to bottom
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolledUp = !isAtBottom;
    }, 100);
  }

  private overrideConfig() {
    if (this.customConfig && Object.keys(this.customConfig).length > 0) {
      currentConfig = { ...globalConfig, ...this.customConfig };
    } else {
      currentConfig = globalConfig;
    }
  }

  override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    
    // Override config if customConfig changes
    if (changedProperties.has('customConfig')) {
      this.overrideConfig();
    }
    
    // Handle chat thread changes
    if (changedProperties.has('chatThread') && this.chatThread.length) {
      const oldChatThread = changedProperties.get('chatThread') as ChatThreadEntry[] || [];
      const hasNewMessage = this.chatThread.length > oldChatThread.length;
      
      // Only reset scroll state when a completely new message is added (new turn in conversation)
      // Don't reset during streaming updates of existing messages
      if (hasNewMessage && !this.isProcessingResponse) {
        this.isUserScrolledUp = false;
      }
      
      // Always scroll to bottom when new messages are added (especially for voice chat injection)
      if (hasNewMessage) {
        this.isUserScrolledUp = false;
        // Use setTimeout to ensure DOM has updated before scrolling
        setTimeout(() => this.scrollToBottom(true), 10);
      } else if (!this.isUserScrolledUp) {
        this.scrollToBottom();
      }
    }
    
    // When processing starts, don't reset scroll state, just try to scroll if allowed
    if (changedProperties.has('isProcessingResponse')) {
      if (this.isProcessingResponse && !this.isUserScrolledUp) {
        setTimeout(() => this.scrollToBottom(), 10);
      }
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    
    // Scroll after DOM updates if we're processing a response
    if (this.isProcessingResponse && !this.isUserScrolledUp) {
      this.scrollToBottom();
    }
    
    // Also scroll when chat thread changes during processing or when new messages are added
    if (changedProperties.has('chatThread')) {
      if (this.isProcessingResponse && !this.isUserScrolledUp) {
        setTimeout(() => this.scrollToBottom(), 5);
      } else {
        // Ensure we scroll to bottom after DOM updates for new messages
        setTimeout(() => this.scrollToBottom(true), 20);
      }
    }
  }

  public scrollToBottom(forced = false): void {
    // Only auto-scroll if user hasn't manually scrolled up
    if (this.isUserScrolledUp && !forced) {
      return;
    }
    
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  /**
   * Reset the scroll state to allow auto-scrolling again
   * Should be called when starting a new conversation turn (new user message)
   */
  public resetScrollState(): void {
    this.isUserScrolledUp = false;
    // Immediately scroll to bottom to ensure we're positioned correctly
    setTimeout(() => {
      const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 10);
  }

  /**
   * Call this when a new user message is sent to reset auto-scroll behavior
   */
  public onNewUserMessage(): void {
    this.isUserScrolledUp = false;
  }

  /**
   * Ensure auto-scrolling is working properly for streaming
   */
  public ensureAutoScroll(): void {
    if (!this.isUserScrolledUp) {
      this.scrollToBottom();
    }
  }

  /**
   * Debug method to check scroll state - can be called from browser console
   */
  public debugScrollState() {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      const threshold = 10;
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
      
      return {
        isUserScrolledUp: this.isUserScrolledUp,
        isAtBottom,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
        clientHeight: scrollContainer.clientHeight,
        distanceFromBottom: scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight,
        isProcessingResponse: this.isProcessingResponse
      };
    }
    return null;
  }

  /**
   * Force scroll to bottom regardless of user scroll state
   * Can be called when explicitly wanting to scroll to bottom
   */
  public forceScrollToBottom(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  @property({ type: Object })
  selectedCitation: Citation | undefined = undefined;

  // Copy response to clipboard
  async copyResponseToClipboard(entry: ChatThreadEntry): Promise<void> {
    const textResponse = chatEntryToString(entry);
    const htmlResponse = chatEntryToHtmlString(entry);
    
    try {
      // Create a proper HTML document fragment for better compatibility
      const fullHtmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
h1, h2, h3, h4, h5, h6 { margin-top: 0; margin-bottom: 0.5em; }
p { margin: 0.5em 0; }
strong { font-weight: bold; }
em { font-style: italic; }
blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #ccc; }
pre { background: #f4f4f4; padding: 1em; border-radius: 4px; }
code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
a { color: #0066cc; text-decoration: underline; }
</style>
</head>
<body>
${htmlResponse}
</body>
</html>`;

      // Use the modern Clipboard API to write both text and HTML formats
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([textResponse], { type: 'text/plain' }),
          'text/html': new Blob([fullHtmlContent], { type: 'text/html' })
        })
      ]);
      this.isResponseCopied = true;
    } catch (err) {
      // Fallback to simple text copy if the enhanced clipboard API fails
      console.warn('Enhanced clipboard copy failed, falling back to text only:', err);
      await navigator.clipboard.writeText(textResponse);
      this.isResponseCopied = true;
    }
  }

  actionButtonClicked(actionButton: ChatActionButton, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();

    const actionButtonClickedEvent = new CustomEvent('on-action-button-click', {
      detail: {
        id: actionButton.id,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(actionButtonClickedEvent);
  }

  private handleCloseOtherCodeViewers(event: Event): void {
    const customEvent = event as CustomEvent;
    const excludeId = customEvent.detail.excludeId;    

    // Find all code-viewer components in the shadow DOM and close them (except the excluded one)
    const codeViewers = this.shadowRoot?.querySelectorAll('code-viewer');
    codeViewers?.forEach(viewer => {
      const viewerId = viewer.getAttribute('componentId');
      if (viewerId !== excludeId && (viewer as any).isCodeVisible) {
        (viewer as any).hideCode();
      }
    });
  }

  // debounce dispatching must-scroll event
  debounceScrollIntoView(): void {
    // Only auto-scroll if user hasn't manually scrolled up
    if (this.isUserScrolledUp) {
      return;
    }
    
    let timeout: any = 0;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (this.chatFooter && !this.isUserScrolledUp) {
        this.chatFooter.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
  }

  handleFollowupQuestionClick(question: string, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();
    const followUpClickEvent = new CustomEvent('on-followup-click', {
      detail: {
        question,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(followUpClickEvent);
  }

  handleFullscreenToggle(event: Event) {
    event.preventDefault();
    const fullscreenToggleEvent = new CustomEvent('on-fullscreen-toggle', {
      detail: {
        isFullscreen: !this.isFullscreen,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(fullscreenToggleEvent);
  }

  handleCitationClick(citation: Citation, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();
    this.selectedCitation = citation;
    const citationClickEvent = new CustomEvent('on-citation-click', {
      detail: {
        citation,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(citationClickEvent);
  }

  async addToKDB(entry: ChatThreadEntry) {

    if((entry.files && entry.files?.length)) {    
      this.addFileToKDB(entry.files[0]);
      return;
    }

    // Check if there's a gen-image in the text and try to get the file
    const txtFile = await this.detectTextFile(entry);
    if (txtFile) {
      this.addFileToKDB(txtFile);
      return;
    }

    this.aiAssistantSignal?.setValue({
      command: 'add_file',
      payload: {
        title: '',
        content: entry.text.map(part => part.value).join(', '),
        contentType: 'text'
      }
    });
  }

  private async detectTextFile(entry: ChatThreadEntry): Promise<MessageFile | null> {
    // Combine all text values from the entry
    const allText = entry.text.map(textPart => textPart.value).join(' ');
    
    // Regular expression to match gen-image tags and extract fileid
    const genImageRegex = /<gen-image[^>]+fileid="([^"]+)"[^>]*>/i;
    const match = allText.match(genImageRegex);
    let fileId;

    if (!match || !match[1]) {
      const genImageRegex2 = /<file-card[^>]+fileid="([^"]+)"[^>]*>/i;
      const match2 = allText.match(genImageRegex2);

      if (!match2 || !match2[1]) {
        return null;
      }else{
         fileId = match2[1];
      }    
    }else{
       fileId = match[1];
    }
  
    try {      
      const response = await fetch(`/api/file/${fileId}`, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` } });
      
      if (!response.ok) {
        return null;
      }
      
      const fileData = await response.json();      
      return fileData.data;
    } catch (error) {
      return null;
    }
  }

  addFileToKDB(file: MessageFile) {    
    this.aiAssistantSignal?.setValue({
      command: 'add_file',
      payload: {
        title: file.originalName,
        content: '',
        contentType: 'file',
        file
      }
    });
  }

  renderPendingReasoning() {
    // No longer needed since we create messages immediately when reasoning starts
    return '';
  }

  override render() {
    return RenderThreadHelper.renderMainThread.bind(this)(currentConfig, this.isTalking, this.upperLoader);
  }
}
