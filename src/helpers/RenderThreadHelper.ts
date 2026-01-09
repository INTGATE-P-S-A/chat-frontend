import { ChatThreadComponent } from "../components/chat-thread-component.js";
import { html } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import iconSuccess from '../svg/success-icon.svg?raw';
import iconCopyToClipboard from '../svg/copy-icon.svg?raw';
import iconQuestion from '../svg/bubblequestion-icon.svg?raw';

import { parseTools } from '../core/parser/toolsParser.js';

export class RenderThreadHelper {
  static renderMainThread(this: ChatThreadComponent, currentConfig: any, isTalking: 0 | 1 | 2 = 0, upperLoader: boolean = false) {
    return html`
    <div id="chat__thread-container">
      <div class="chat-topic">
        <h5 class="mr-3">
          ${this.conversationTitle}
        </h5>
        ${this.conversationUid ? html`<share-window convoUid="${this.conversationUid}"></share-window>` : ''}
        ${ isTalking > 0 ? html`<div class="talking-indicator${isTalking === 2 ? ' talking' : '' }">
          <i class="simple-icon-earphones-alt" />
          ${isTalking === 1 ? html`<app-loader block="true" indicatorWidth="2px" width="15px" height="15px"></app-loader>` : ''}
        </div>` : '' }
        ${ upperLoader ? html`<loading-indicator></loading-indicator>` : '' }
        <button 
            type="button"
            class="fullscreen-toggle-btn ${this.isFullscreen ? 'simple-icon-close' : 'simple-icon-size-fullscreen'}"
            @click="${this.handleFullscreenToggle}"
            title="${this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}"
            ?disabled="${this.isDisabled}"
        ></button>
      </div>
      <ul class="chat__list" aria-live="assertive">
        ${this.chatThread.map(
          (message, index) => RenderThreadHelper.renderMessage.bind(this)(message, index, currentConfig)
        )}
        ${RenderThreadHelper.renderPendingReasoning.bind(this)()}
        </ul>
      </div>
      <div class="chat__footer" id="chat-list-footer">
        <!-- Do not delete this element. It is used for auto-scrolling -->
      </div>
    `;
  }

  static renderMessage(this: ChatThreadComponent, message: ChatThreadEntry, index: number, currentConfig: any) {
    const isLastMessage = index === this.chatThread.length - 1;
    const showLoadingIndicator = this.isProcessingResponse && isLastMessage && !message.isUserMessage;    
    return html`
      <li class="chat__listItem ${message.isUserMessage ? 'user-message' : 'ai-message'}">
        ${!message.isUserMessage ? RenderThreadHelper.renderAiAvatar() : ''}
        
        <div class="message-content">
          <div class="chat__txt ${message.isUserMessage ? 'user-message' : ''}">
            ${!message.isUserMessage ? RenderThreadHelper.renderReasoningViewer.bind(this)(index, currentConfig) : ''}
${message.tools && message.tools.length > 0 ? unsafeHTML(parseTools(message.tools)) : ''}
            ${RenderThreadHelper.renderFiles.bind(this)(message, currentConfig)}
            ${message.text.map((textEntry) => RenderThreadHelper.renderTextEntry.bind(this)(textEntry, message.isUserMessage))}                      
            ${RenderThreadHelper.renderCitation.bind(this)(message, currentConfig)}
            ${RenderThreadHelper.renderFollowupQuestions.bind(this)(message)} 
            ${message.error ? RenderThreadHelper.renderError(message.error) : ''}
            ${showLoadingIndicator ? html`<loading-indicator label=""></loading-indicator>` : ''}
          </div>
          <div class="chat__txt--footer">
            <div class="chat__txt--info">                              
              <span class="timestamp">${RenderThreadHelper.formatTo24Hour(message.timestamp)}</span>
              ${RenderThreadHelper.renderUserInfo(message)}                       
              ${RenderThreadHelper.renderCostInfo(message)}
              ${RenderThreadHelper.renderModelInfo(message)}     
            </div>
            <div class="chat__response-actions">                  
              ${message.isUserMessage ? '' : RenderThreadHelper.renderResponseActions.bind(this)(message, currentConfig)}                                              
            </div>
          </div>
        </div>
        
        ${message.isUserMessage ? RenderThreadHelper.renderUserAvatar() : ''}
      </li>
    `;
  }

  static renderAiAvatar() {
    return html`
      <div class="message-avatar">
        <div class="ai-avatar">AI</div>
      </div>
    `;
  }

  static renderUserAvatar() {
    return html`
      <div class="message-avatar">
        <img src="/assets/images/avatar.jpg" alt="User" style="width: 32px; height: 32px; border-radius: 50%;">
      </div>
    `;
  }

  static renderResponseActions(this: ChatThreadComponent, entry: ChatThreadEntry, currentConfig: any) {
    return html`
      <header class="chat__header">
        <div class="chat__header--button">
          ${this.actionButtons.map(
            (actionButton) => html`
                <chat-action-button
                  .label="${actionButton.label}"
                  .svgIcon="${actionButton.svgIcon}"
                  .isDisabled="${actionButton.isDisabled}"
                  .actionId="${actionButton.id}"
                  @click="${(event) => this.actionButtonClicked(actionButton, entry, event)}"
                ></chat-action-button>
              `,
          )}
          <chat-action-button
            .label="${currentConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
            .svgIcon="${this.isResponseCopied ? iconSuccess : iconCopyToClipboard}"
            .isDisabled="${this.isDisabled}"
            actionId="copy-to-clipboard"
            .tooltip="${this.isResponseCopied
              ? currentConfig.COPIED_SUCCESSFULLY_MESSAGE
              : currentConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
            @click="${() => this.copyResponseToClipboard(entry)}"
          ></chat-action-button>
          <chat-action-button
            .label="${currentConfig.ADD_KDB_BUTTON_LABEL_TEXT}"
            simpleIcon="book-open"            
            .isDisabled="${this.isDisabled}"
            actionId="add-to-kdb"
            .tooltip="${currentConfig.ADD_KDB_BUTTON_LABEL_TEXT}"
            @click="${() => this.addToKDB(entry)}"
          ></chat-action-button>
        </div>
      </header>
    `;
  }

  static renderTextEntry(this: ChatThreadComponent, textEntry: ChatMessageText, isUserMessage: boolean = false) {
    // Don't render empty text entries
    if (!textEntry.value || textEntry.value.trim() === '') {
      return '';
    }
    
    // Convert newlines to <br/> tags for user messages
    let processedValue = textEntry.value;
    if (isUserMessage) {
      processedValue = textEntry.value.replace(/\n/g, '<br/>');
    }
    
    const entries = [html`<p class="chat__txt--entry">${unsafeHTML(processedValue)}</p>`];
    
    // render steps
    if (textEntry.followingSteps && textEntry.followingSteps.length > 0) {
      entries.push(html`
        <ol class="items__list steps">
          ${textEntry.followingSteps.map(
            (followingStep) => html` <li class="items__listItem--step">${unsafeHTML(followingStep)}</li> `,
          )}
        </ol>
      `);
    }
    if (this.isProcessingResponse) {
      this.debounceScrollIntoView();
    }
    return html`<div class="chat_txt--entry-container">${entries}</div>`;
  }



  static renderFiles(this: ChatThreadComponent, entry: ChatThreadEntry, currentConfig: any) {
    if (!entry.files || entry.files.length === 0) {
      return '';
    }

    // Handle both file structures: frontend uploaded files (type, name) and backend files (mimeType, originalName)
    const imageFiles = entry.files.filter(file => {
      const fileType = file.mimeType;
      return fileType && fileType.startsWith('image/');
    });
    
    const nonImageFiles = entry.files.filter(file => {
      const fileType = file.mimeType;
      return fileType && !fileType.startsWith('image/');
    });
    
    return html`
      <div class="chat__files">
        ${imageFiles.map(file => RenderThreadHelper.renderImageFile.bind(this)(file, currentConfig))}
        ${nonImageFiles.map(file => RenderThreadHelper.renderNonImageFile.bind(this)(file, currentConfig))}
      </div>
    `;
  }

  static renderImageFile(this: ChatThreadComponent, file: MessageFile, currentConfig: any) {    
    // Use the correct properties based on file structure
    const mimeType = file.mimeType;
    
    if (file.tmp) {
      // For temporary files (newly sent), use base64 content
      return html`
        <div class="file-item">
          <gen-image 
            tmp="true"
            imageFormat="${mimeType ? mimeType.split('/')[1] || 'png' : 'png'}"
          >${file.base64}</gen-image>          
        </div>
      `;
    } else {
      // For persisted files (from data-initial-messages), use fileId
      return html`
        <div class="file-item is-userborn">
          <gen-image 
            fileId="${file.id}"
            imageFormat="${mimeType ? mimeType.split('/')[1] || 'png' : 'png'}"
          ></gen-image>
          <div class="file-item__actions">
            <chat-action-button
            .label="${currentConfig.ADD_KDB_BUTTON_LABEL_TEXT}"
            simpleIcon="book-open"                        
            actionId="add-to-kdb"
            .altColor="${true}"
            .tooltip="${currentConfig.ADD_KDB_BUTTON_LABEL_TEXT}"
            @click="${() => this.addFileToKDB(file)}"
          ></chat-action-button>
          </div>
        </div>
      `;
    }
  }

  static renderNonImageFile(this: ChatThreadComponent, file: MessageFile, _currentConfig: any) {
    // Use the file-card component instead of custom HTML
    return html`
      <file-card 
        fileId="${file.id}" 
        showDownload="true" 
        showAddToKdb="true"
        @add-to-kdb="${() => this.addFileToKDB(file)}"
      ></file-card>
    `;
  }

  static renderCitation(this: ChatThreadComponent, entry: ChatThreadEntry, currentConfig: any) {
    const citations = entry.citations;
    if (citations && citations.length > 0) {
      return html`
        <div class="chat__citations">
          <citation-list
            .citations="${citations}"
            .label="${currentConfig.CITATIONS_LABEL}"
            .selectedCitation=${this.selectedCitation}            
            @on-citation-click="${(event: CustomEvent) =>
              this.handleCitationClick(event.detail.citation, entry, event)}"
          ></citation-list>
        </div>
      `;
    }

    return '';
  }

  static renderFollowupQuestions(this: ChatThreadComponent, entry: ChatThreadEntry) {
    const followupQuestions = entry.followupQuestions;
    // render followup questions
    // need to fix first after decoupling of teaserlist
    if (followupQuestions && followupQuestions.length > 0) {
      return html`
        <div class="items__listWrapper">
          ${unsafeSVG(iconQuestion)}
          <ul class="items__list followup">
            ${followupQuestions.map(
              (followupQuestion) => html`
                <li class="items__listItem--followup">
                  <a
                    class="items__link"
                    href="#"
                    data-testid="followUpQuestion"
                    @click="${(event) => this.handleFollowupQuestionClick(followupQuestion, entry, event)}"
                    >${followupQuestion}</a
                  >
                </li>
              `,
            )}
          </ul>
        </div>
      `;
    }

    return '';
  }

  static renderError(error: { message: string }) {
    return html`<p class="chat__txt error">${error.message}</p>`;
  }

  static renderReasoningViewer(this: ChatThreadComponent, messageIndex: number, currentConfig: any) {
    // Get the message at this index and check if it has reasoning or thoughts
    const message = this.chatThread[messageIndex];
    
    if (!message || (!message.reasoning && !message.thoughts)) {
      return '';
    }
    
    // Use reasoning if available, otherwise use thoughts
    const reasoningText = message.reasoning || message.thoughts;
    
    // For initial messages (loaded from backend), they should be closed by default
    // if showInitialMessagesReasoningClosed is true
    // During active processing, use the global isReasoningClosed setting
    const shouldBeClosed = this.isProcessingResponse ? this.isReasoningClosed : this.showInitialMessagesReasoningClosed;
    
    return html`
      <reasoning-viewer
        component-id="${message.id}"
        label="${currentConfig.REASONING_LABEL}"
        .reasoningText="${reasoningText || ''}"
        .closed="${shouldBeClosed}"
      ></reasoning-viewer>
    `;
  }

  static renderPendingReasoning() {
    // No longer needed since we create messages immediately when reasoning starts
    return '';
  }

  static formatTo24Hour(timestamp: number): string {    
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  static renderCostInfo(entry: ChatThreadEntry) {
    if (entry.isUserMessage) {
      return '';
    }

    // Handle both single cost and costs array formats
    let costData: IPromptCost | null = null;
    
    if (entry.cost) {
      costData = entry.cost;
    } else if (entry.costs && entry.costs.length > 0) {
      // If we have multiple costs, sum them up or take the first one
      if (entry.costs.length === 1) {
        costData = entry.costs[0];
      } else {
        // Sum up all costs
        costData = entry.costs.reduce((total, current) => ({
          prompt_tokens: total.prompt_tokens + current.prompt_tokens,
          completion_tokens: total.completion_tokens + current.completion_tokens,
          total_tokens: total.total_tokens + current.total_tokens,
          cost: total.cost + current.cost,
          reasoning_tokens: (total.reasoning_tokens || 0) + (current.reasoning_tokens || 0)
        }));
      }
    }

    if (!costData) {
      return '';
    }

    const { prompt_tokens, completion_tokens, total_tokens, cost } = costData;
    
    return html`
      <span class="cost-info" title="Tokens: ${prompt_tokens} + ${completion_tokens} = ${total_tokens}">
        💰 $${cost.toFixed(4)}
      </span>
    `;
  }

  static renderModelInfo(entry: ChatThreadEntry) {
    if (entry.isUserMessage || !entry.model) {
      return '';
    }

    return html`
      <span class="model-info" title="AI Model: ${entry.model}">
        🤖 ${entry.model}
      </span>
    `;
  }

  static renderUserInfo(entry: ChatThreadEntry) {
    // For AI messages, don't show user info
    if (!entry.isUserMessage) {
      return '';
    }

    let userData = entry.user;

    // If user data is not available in the entry (fresh message), get it from localStorage
    if (!userData) {
      try {
        const jwtUserString = localStorage.getItem('jwt_user');
        if (jwtUserString) {
          userData = JSON.parse(jwtUserString);
        }
      } catch (error) {
        // Failed to parse jwt_user from localStorage
      }
    }

    // If still no user data available, don't show user info
    if (!userData) {
      return '';
    }

    const displayName = userData.name && userData.last_name 
      ? `${userData.name} ${userData.last_name}` 
      : userData.username;

    return html`
      <span class="user-info">
        ${displayName}
      </span>
    `;
  }
}