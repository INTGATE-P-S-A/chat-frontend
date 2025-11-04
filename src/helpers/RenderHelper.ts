import { ChatComponent } from "../components/chat-component";
import { html } from 'lit';

import iconLogo from '../svg/branding/brand-logo.svg?raw';
import megaphoneSvg from '../svg/megaphone.svg?raw';
import downloadSvg from '../svg/download.svg?raw';
import { FilesHelper } from "./FilesHelper";
import { HandlerHelper } from "./HandlerHelper";

export class RenderHelper {
  static mainRender(this: ChatComponent, globalConfig: any, teaserListTexts: any) {
    return html`
      <div id="overlay" class="overlay ${this.isAsideOpen ? 'active' : ''}"></div>
      <section id="chat__containerWrapper" class="chat__containerWrapper ${this.isFullscreen ? ' has-fullscreen' : ''}${this.isAsideOpen ? ' aside-open' : ''}${this.isDragOver ? ' drag-over' : ''}">
        ${this.isCustomBranding && !this.isChatStarted
        ? html` <chat-stage
              svgIcon="${iconLogo}"
              pagetitle="${globalConfig.BRANDING_HEADLINE}"
              url="${globalConfig.BRANDING_URL}"
            >
            </chat-stage>`
        : ''}
        
        ${this.isFullscreen ? html`<div class="fullscreen-col"><conversation-list selectedconversationid="${this.convoId}" fullmode="true"></conversation-list></div>` : ''}            

        <section class="chat__container" id="chat-container"> 
        
          ${this.isChatStarted
        ? html`
                <div class="chat__messages-container">
                  ${RenderHelper.renderChatThread.bind(this)(this.chatThread, globalConfig)}                  
                  ${!this.chatController.isAwaitingResponse && this.isShowingProgress
            ? html`<progress-bar 
                    .progress="${this.progressPercentage}"
                    .message="${this.progressMessage}"
                    .stage="${this.progressStage}">
                  </progress-bar>`
            : ''}
                  ${this.isDefaultPromptsEnabled && this.isChatStarted
            ? html`<div style="padding: 1rem;">
                      <teaser-list-component
                        .heading="${this.interactionModel === 'chat'
                ? teaserListTexts.HEADING_CHAT
                : teaserListTexts.HEADING_ASK}"
                        .clickable="${true}"
                        .actionLabel="${teaserListTexts.TEASER_CTA_LABEL}"
                        @teaser-click="${HandlerHelper.handleQuestionInputClick.bind(this)}"
                        .teasers="${teaserListTexts.DEFAULT_PROMPTS}"
                      ></teaser-list-component>
                    </div>`
            : ''}
                </div>
              `
        : ''}
       
         
           
            ${this.isDefaultPromptsEnabled && !this.isChatStarted
        ? html`<div class="chat__container">        
                  <teaser-list-component
                    .heading="${this.interactionModel === 'chat'
            ? teaserListTexts.HEADING_CHAT
            : teaserListTexts.HEADING_ASK}"
                    .clickable="${true}"
                    .actionLabel="${teaserListTexts.TEASER_CTA_LABEL}"
                    @teaser-click="${HandlerHelper.handleQuestionInputClick.bind(this)}"
                    .teasers="${teaserListTexts.DEFAULT_PROMPTS}"
                  ></teaser-list-component>
                </div>`
        : ''}
        
          ${false ? html`<voice-chat voice="${this.chatSettings.voice}" model="${this.overrides.selectedModel ? `${this.overrides.selectedModel.model.value}` : ''}" avatar="${this.overrides.avatar ? `${this.overrides.avatar}` : ''}"></voice-chat>` : ''}
        
          ${this.showControls ? html`<form
            id="chat-form"
            class="form__container ${this.inputPosition === 'sticky' ? 'form__container-sticky' : ''}${this.isDragOver ? ' drag-over' : ''}"
            @dragover="${FilesHelper.onFormDragOver.bind(this)}"
            @dragleave="${FilesHelper.onFormDragLeave.bind(this)}"
            @drop="${FilesHelper.onDrop.bind(this)}"
          >
            ${RenderHelper.aiAssistRender.bind(this)()}
            ${RenderHelper.filePreviewRender.bind(this)()}
            ${this.showControls ? html`<div class="input-helper-text">
              <span class="keyboard-shortcut">
                ${globalConfig.CHAT_INPUT_NEWLINE_HELPER}
              </span>
            </div>` : ''}
            <div class="chatbox__container">
              <div class="chatbox__input-container">
                <div class="input_container_wrapper">
                  <textarea
                    class="chatbox__input"
                    data-testid="question-input"
                    id="question-input"
                    placeholder="${globalConfig.CHAT_INPUT_PLACEHOLDER}"
                    aria-labelledby="chatbox-label"
                    name="chatbox"
                    type="text"
                    ?disabled="${this.isDisabled}"
                    autocomplete="off"
                    @keyup="${this.handleOnInputChange}"
                    @input="${this.handleOnInputChange}"
                    @paste="${this.handlePasteEvent.bind(this)}"                    
                  ></textarea>
                  ${RenderHelper.renderFilePrompt.bind(this)(globalConfig)}
                  ${this.chatController.isAwaitingResponse
          ? html`<loading-indicator label="${globalConfig.LOADING_INDICATOR_TEXT}"></loading-indicator>` : ''}                  
                </div>
                <div class="input-group-append">
                  ${this.isResetInput ? html`<button
                    title="${globalConfig.RESET_BUTTON_TITLE_TEXT}"
                    class="chatbox__button btn-outline-danger chat-reset${this.isChatStarted ? ' started' : ''}"
                    type="reset"
                    id="resetBtn"
                    @click="${this.resetInputField}"
                  >
                    <i class="simple-icon-ban"></i>
                  </button>` : ''}
                  ${RenderHelper.renderChatOrCancelButton.bind(this)(globalConfig)}
                  ${this.isResetInput ? '' : html`<rws-tooltip side="left" disabled="true" text="${globalConfig.TOOLTIPS.PROMPT_WITH_MICROPHONE}"><voice-input-button @on-voice-input="${this.handleVoiceInput}" class="chatbox__button btn-outline-secondary voice-button" ?disabled="${true}" /></rws-tooltip>`}
                  ${false ? html`<button
                    title="${globalConfig.LIVE_CHAT_BUTTON_LABEL_TEXT}"
                    class="chatbox__button btn-outline-secondary live-chat"
                    type="reset"
                    id="resetBtn"
                    @click="${this.startLiveChat}"
                  >
                    <i class="simple-icon-speech"></i>
                  </button>` : ''}
                </div>
              </div>
              
            </div>

            ${globalConfig.WEB_SEARCH_CHECKBOX_ENABLED
          ? html`<div class="web-search__wrapper">                  
                  <simple-model-select                         
                    value="${this.overrides.selectedModel ? this.overrides.selectedModel.model.value : (this.overrides.avatar ? this.overrides.avatar : null)}">
                  </simple-model-select> 
                  <div class="web-search__container">
                    <input
                      type="checkbox"
                      class="web-search__checkbox"
                      id="web-search-checkbox"
                      .checked="${this.webSearchEnabled}"
                      @change="${HandlerHelper.handleWebSearchChange.bind(this)}"              
                      ?disabled="${this.isDisabled}"
                    />
                    <label class="web-search__label" for="web-search-checkbox">
                      ${globalConfig.WEB_SEARCH_CHECKBOX_LABEL}
                    </label>
                  </div>
                  ${globalConfig.DEEP_SEARCH_CHECKBOX_ENABLED && this.webSearchEnabled
              ? html`<div class="web-search__container">
                        <input
                          type="checkbox"
                          class="web-search__checkbox"
                          id="deep-search-checkbox"
                          .checked="${this.deepSearchEnabled}"
                          @change="${HandlerHelper.handleDeepSearchChange.bind(this)}"
                          ?disabled="${this.isDisabled}"
                        />
                        <label class="web-search__label" for="deep-search-checkbox">
                          ${globalConfig.DEEP_SEARCH_CHECKBOX_LABEL}
                        </label>
                      </div>`
              : ''}
                  ${RenderHelper.renderExtraInputFooterButtons.bind(this, globalConfig)()}
                </div>`
          : html`
                <div class="web-search__wrapper">
                  <simple-model-select                         
                        value="${this.overrides.selectedModel ? this.overrides.selectedModel.model.value : (this.overrides.avatar ? this.overrides.avatar : null)}">
                  </simple-model-select>  
                  <button 
                    class="fullscreen-toggle-btn ${this.isFullscreen ? 'simple-icon-close' : 'simple-icon-size-fullscreen'}"
                    @click="${HandlerHelper.handleFullscreenToggle.bind(this)}"
                    title="${this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}"
                    ?disabled="${this.isDisabled}"
                  ></button>
                  ${RenderHelper.renderExtraInputFooterButtons.bind(this, globalConfig)()}
                </div>`}

            ${this.isDefaultPromptsEnabled
          ? ''
          : ''}
          </form>` : ''}
        </section>        
        ${this.isAsideOpen && this.showCode?.id
        ? html`
              <aside class="aside">
                <code-screen 
                  language="${this.showCode.language}" 
                  componentId=${this.showCode.id} 
                  .passedContent=${this.showCode.code} 
                  .activatePreview="${this.showCode.preview}" 
                  .ended="${this.showCode.ended}"></code-screen>
              </aside>
            `
        : ''}
        ${this.showSettings
        ? html`
            <rws-modal name="chat_settings" centerTop="true"}">
              <chat-settings></chat-settings>
            </rws-modal>
            `
        : ''}
      </section>
    `;
  }

  static renderFilePrompt(this: ChatComponent, globalConfig: any) {
    return html`<div class="file-prompt-wrap"><button
      class="chatbox__file_prompt"
      data-testid="submit-prompt-button"
      type="button"
      @click="${FilesHelper.handleAddFile.bind(this)}"      
      ?disabled="${this.isDisabled}"
    >
      <rws-tooltip side="left" text="${globalConfig.TOOLTIPS.ATTACH_FILE_TO_PROMPT}"><i class="simple-icon-paper-clip"></i></rws-tooltip>
    </button></div>`;
  }

  static filePreviewRender(this: ChatComponent) {
    if (!this.promptFiles || this.promptFiles.length === 0) {
      return html``;
    }

    return html`<div id="file-prompt-preview" class="file-prompt-preview">
    ${this.promptFiles.map((file, index) => html`
      <div class="file-prompt__file">      
        ${file.mimeType && file.mimeType.startsWith('image/')
        ? html`<img class="file-prompt__img" src="data:${file.mimeType};base64,${file.base64}" alt="${file.filename}" />`
        : html`<div class="file-prompt__img file-prompt__file-icon">
              <i class="simple-icon-doc"></i>
              <span>${file.mimeType ? file.mimeType.split('/')[1]?.toUpperCase() || 'FILE' : 'FILE'}</span>
            </div>`
      }
        <div class="file-prompt__footer">
          <span class="file-prompt__file-size">${file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}</span>
          <button class="file-prompt__remove-button" type="button" @click="${() => FilesHelper.removeFile.bind(this)(index)}">
            <i class="simple-icon-close"></i>
          </button>
        </div>
      </div>
    `)}
  </div>`;
  }

  static renderChatThread(this: ChatComponent, chatThread: ChatThreadEntry[], globalConfig: any) {
    return html`<chat-thread-component
      .aiAssistantSignal="${this.aiAssistantSignal}"
      .chatThread="${chatThread}"
      .conversationTitle="${this.overrides.conversationTitle}"
      .conversationUid="${this.overrides.conversationUid}"
      .customConfig="${this.customConfig}"
      .isTalking="${this.isTalking}"
      .upperLoader="${this.upperLoader}"
      .showInitialMessagesReasoningClosed="${true}"
      .actionButtons="${[
        // {
        //   id: 'chat-show-thought-process',
        //   label: globalConfig.SHOW_THOUGH_PROCESS_BUTTON_LABEL_TEXT,
        //   svgIcon: iconLightBulb,
        //   isDisabled: this.isShowingThoughtProcess,
        // },
        {
          id: 'speak',
          label: globalConfig.SPEAK_BUTTON_LABEL_TEXT,
          svgIcon: megaphoneSvg,
          isDisabled: true,
        },
        {
          id: 'download-speech',
          label: globalConfig.DOWNLOAD_SPEECH_BUTTON_LABEL_TEXT,
          svgIcon: downloadSvg,
          isDisabled: true,
        },
      ] as any}"
      .isDisabled="${this.isDisabled}"
      .isProcessingResponse="${this.chatController.isProcessingResponse}"
      .selectedCitation="${this.selectedCitation}"
      .isCustomBranding="${this.isCustomBranding}"
      .isFullscreen="${this.isFullscreen}"
      .svgIcon="${iconLogo}"
      @on-action-button-click="${HandlerHelper.handleChatEntryActionButtonClick.bind(this)}"
      @on-citation-click="${HandlerHelper.handleCitationClick.bind(this)}"
      @on-followup-click="${HandlerHelper.handleQuestionInputClick.bind(this)}"
      @on-fullscreen-toggle="${HandlerHelper.handleFullscreenToggle.bind(this)}"
    >
    </chat-thread-component>`;
  }

  static renderChatOrCancelButton(this: ChatComponent, globalConfig: any) {
    const submitChatButton = html`<rws-tooltip side="left" text="${globalConfig.TOOLTIPS.SEND_PROMPT}"><button
          class="chatbox__button chatbox_submit"
          data-testid="submit-question-button"
          @click="${this.handleUserChatSubmit}"
          title="${globalConfig.CHAT_BUTTON_LABEL_TEXT}"
          ?disabled="${this.isDisabled}"
        >
          <i class="simple-icon-paper-plane"></i>
        </button></rws-tooltip>`;
    const cancelChatButton = html`<rws-tooltip side="left" text="${globalConfig.TOOLTIPS.CANCEL_REQUEST}"><button
          class="chatbox__button"
          data-testid="cancel-question-button"
          @click="${this.handleUserChatCancel}"
          title="${globalConfig.CHAT_CANCEL_BUTTON_LABEL_TEXT}"
        >
          <i class="simple-icon-close"></i>
        </button></rws-tooltip>`;

    return this.chatController.isProcessingResponse ? cancelChatButton : submitChatButton;
  }

  static renderExtraInputFooterButtons(this: ChatComponent, globalConfig: any) {
    return html`<div class="kdb-pick"><knowledge-picker absolute="true"></knowledge-picker></div>          
                <div class="settings-toggler"><rws-tooltip side="left" text="${globalConfig.TOOLTIPS.CHAT_SETTINGS}"><button  type="button" @click="${this.handleSettingsExpandAside}"><i class="simple-icon-settings"></i></button></rws-tooltip></div>`;
  }

  static aiAssistRender(this: ChatComponent) {
    return html`<ai-assist id="ai-assist-component"></ai-assist>`;
  }
}