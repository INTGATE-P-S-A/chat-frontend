import { ChatComponent } from "../components/chat-component";
import { chatEntryToString } from "../utils";

export class ThreadHelper {
    static clearChat(this: ChatComponent) {
        this.chatThread = [];
        this.isChatStarted = false;
        this.isDefaultPromptsEnabled = true;
        this.liveChatOn = false;
        this.showControls = true;
        this.showCode = null;

        this.promptFiles = [];
        this.initialMessages = [];
        
        // Also remove the HTML attribute to prevent restoration
        this.removeAttribute('data-initial-messages');

        // Update assist context after clearing chat
        this.updateAssistContext();

        ThreadHelper.resetThread.bind(this)(new Event('clear-chat'), true);

    }

    static resetThread(this: ChatComponent, event: Event, forced: boolean = false): void {
        this.isChatStarted = false;
        this.chatThread = [];
        this.isDisabled = false;
        this.isDefaultPromptsEnabled = true;
        this.selectedCitation = undefined;
        this.chatController.reset();

        this.promptFiles = [];

        // Update assist context after resetting thread
        this.updateAssistContext();

        const chatThreadComponent = this.renderRoot?.querySelector('chat-thread-component');
        if (chatThreadComponent && typeof (chatThreadComponent as any).clearAllReasoning === 'function') {
            (chatThreadComponent as any).clearAllReasoning();
        }

        if (chatThreadComponent && typeof (chatThreadComponent as any).resetScrollState === 'function') {
            (chatThreadComponent as any).resetScrollState();
        }


        this.collapseAside(event);
        this.handleUserChatCancel(event);

        if (!forced) {
            const resetEvent = new CustomEvent('chat:conversation:end', {
                detail: true,
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(resetEvent);
        }
    }

    static getMessageContext(this: ChatComponent) {
        if (this.interactionModel === 'ask') {
            return [];
        }

        const messages: Message[] = this.chatThread.map((entry) => {
            const message: Message = {
                content: entry.isUserMessage ? chatEntryToString(entry) : (entry.rawContent || chatEntryToString(entry)),
                role: entry.isUserMessage ? 'user' : 'assistant',
            };

            if (entry.files && entry.files.length > 0) {
                message.files = entry.files;
            }

            return message;
        });

        return messages;
    }
}