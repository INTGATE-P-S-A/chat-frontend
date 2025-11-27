import { ChatComponent } from "../components/chat-component";

export class HandlerHelper {
    static handleQuestionInputClick(this: ChatComponent, event: CustomEvent): void {
        event?.preventDefault();
        this.setQuestionInputValue(event?.detail?.question);
    }

    static handleCitationClick(this: ChatComponent, event: CustomEvent): void {
        event?.preventDefault();
        this.selectedCitation = event?.detail?.citation;

        if (!this.showCode) {
            if (event?.detail?.chatThreadEntry) {
                this.selectedChatEntry = event?.detail?.chatThreadEntry;
            }
            this.handleCodeExpandAside();
        }
    }

    static handleAdvancedPromptingChange(this: ChatComponent, event: Event): void {
        this.advancedPromptingEnabled = !this.advancedPromptingEnabled;
    }

    static handleWebSearchChange(this: ChatComponent, event: Event): void {
        const target = event.target as HTMLInputElement;
        this.webSearchEnabled = target.checked;

        this.dispatchEvent(new CustomEvent('websearch-change', {
            detail: { checked: this.webSearchEnabled },
            bubbles: true,
            composed: true
        }));
    }

    static handleDeepSearchChange(this: ChatComponent, event: Event): void {
        const target = event.target as HTMLInputElement;
        this.deepSearchEnabled = target.checked;

        this.dispatchEvent(new CustomEvent('deepsearch-change', {
            detail: { checked: this.deepSearchEnabled },
            bubbles: true,
            composed: true
        }));
    }

    static handleFullscreenToggle(this: ChatComponent): void {
        this.isFullscreen = !this.isFullscreen;

        if (this.isFullscreen) {
            this.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }

        this.dispatchEvent(new CustomEvent('fullscreen-change', {
            detail: { isFullscreen: this.isFullscreen },
            bubbles: true,
            composed: true
        }));
    }

    static handleFullscreenChange(this: ChatComponent): void {
        this.isFullscreen = !!document.fullscreenElement;
    }

    static handleChatEntryActionButtonClick(this: ChatComponent, event: CustomEvent) {
        if (event.detail?.id === 'chat-show-thought-process') {
            this.selectedChatEntry = event.detail?.chatThreadEntry;
            this.handleCodeExpandAside(event);
        }

        if (event.detail?.id === 'speak') {
            this.selectedChatEntry = event.detail?.chatThreadEntry;
            HandlerHelper.speak.bind(this)(event, this.selectedChatEntry as ChatThreadEntry);
        }

        if (event.detail?.id === 'download-speech') {
            this.selectedChatEntry = event.detail?.chatThreadEntry;
            HandlerHelper.speak.bind(this)(event, this.selectedChatEntry as ChatThreadEntry, true);
        }
    }

    static speak(this: ChatComponent, event: Event, message: ChatThreadEntry, download = false) {
        event.preventDefault();

        const speakEvent = new CustomEvent(download ? 'chat:download' : 'chat:speak', {
            detail: {
                message: message.text.map((textEntry) => textEntry.value).join(' '),
            },
            bubbles: true,
            composed: true,
        });

        this.dispatchEvent(speakEvent);
    }

    static handleDiscussionLLMTurn(this: ChatComponent): void {
        const context = this.getMessageContext();

        // Only update AI assist if the feature is enabled and component is available
        if (this.aiAssist && this.currentUser?.accountGrade?.promptAssist && typeof (this.aiAssist as any).updateContextFromMessages === 'function') {
            (this.aiAssist as any).updateContextFromMessages(context);            
        }

         const llmTurnEvent = new CustomEvent('chat:llm-turn', {
            detail: {
                messageContext: context,
            },
            bubbles: true,
            composed: true,
        });

        this.dispatchEvent(llmTurnEvent);
    }

    static handleDiscussionUserTurn(this: ChatComponent, messagesWithNewInput: Message[]): void {        
        const llmTurnEvent = new CustomEvent('chat:user-turn', {
            detail: {
                messageContext: messagesWithNewInput,
            },
            bubbles: true,
            composed: true,
        });

        this.dispatchEvent(llmTurnEvent);
    }
}