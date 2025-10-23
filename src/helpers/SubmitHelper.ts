import { ChatComponent } from "../components/chat-component";
import DOMPurify from 'dompurify';
import { FilesHelper } from "./FilesHelper";

export class SubmitHelper {
    static async handleSubmit(this: ChatComponent, requestOptions: any, chatHttpOptions: any): Promise<void> {        

        // Close all existing code-viewers before sending new message
        this.dispatchEvent(new CustomEvent('chat:message:sending', {
            bubbles: true,
            composed: true
        }));

        const question = DOMPurify.sanitize(this.questionInput.value);

        // Clear the form and uploaded files immediately after clicking send
        this.questionInput.value = '';
        this.isResetInput = false;
        const filesToProcess = [...this.promptFiles]; // Store files to process
        this.promptFiles = []; // Clear uploaded files immediately

        // Set loading state immediately to show loading indicator in text prompt area
        this.chatController.isAwaitingResponse = true;

        try {
            // Reset scroll state for every new message to enable auto-scrolling
            const chatThreadComponent = this.renderRoot?.querySelector('chat-thread-component');
            if (chatThreadComponent && typeof (chatThreadComponent as any).resetScrollState === 'function') {
                (chatThreadComponent as any).resetScrollState();
            }

            this.isChatStarted = true;
            this.isDefaultPromptsEnabled = false;

            // Prepare the current message context
            const currentMessages = this.getMessageContext();

            let uploadedFiles: any[] = [];

            // Upload files to backend if any
            if (filesToProcess.length > 0) {
                try {
                    const uploadResponse = await FilesHelper.uploadFiles.bind(this)(filesToProcess);
                    if (uploadResponse.success) {
                        uploadedFiles = uploadResponse.files;
                    }
                } catch (error) {
                    console.error('Error uploading files:', error);
                    this.dispatchEvent(new CustomEvent('popup:show', {
                        detail: {
                            message: 'file.upload.error.upload_failed',
                            type: 'error',
                            params: {
                                error: error instanceof Error ? error.message : 'Unknown error'
                            }
                        },
                        bubbles: true,
                        composed: true
                    }));
                    // Continue with original base64 approach as fallback
                }
            }

            // Build the new user message with multimodal content if files are present
            let userMessage: Message;
            if (filesToProcess.length > 0) {
                // Create multimodal content array
                const contentArray: any[] = [];

                // Add text content if we have a question
                if (question.trim()) {
                    contentArray.push({
                        type: 'text',
                        text: question
                    });
                }

                // Add image content for each file
                for (const file of filesToProcess) {
                    contentArray.push({
                        type: 'image',
                        image: file.base64 // This should already be in data URI format
                    });
                }

                userMessage = {
                    content: contentArray,
                    role: 'user',
                    files: uploadedFiles.length > 0 ? uploadedFiles : filesToProcess // Include uploaded files or fallback to original format
                };
            } else {
                // Simple text message
                userMessage = {
                    content: question,
                    role: 'user'
                };
            }

            // Add the new message to the context
            const messagesWithNewInput = [...currentMessages, userMessage];

            const requestOverrides = {
                ...requestOptions.overrides,
                ...this.overrides,
                chatSettings: this.chatSettings,
                webSearchEnabled: this.webSearchEnabled,
                deepSearchEnabled: this.deepSearchEnabled,
            };

            console.log('Final request overrides:', requestOverrides);

            await this.chatController.generateAnswer(
                {
                    ...requestOptions,
                    overrides: requestOverrides,
                    question: filesToProcess.length > 0 ? '' : question, // Clear question when using multimodal format
                    type: this.interactionModel,
                    messages: messagesWithNewInput,
                },
                {
                    // use defaults
                    ...chatHttpOptions,

                    // override if the user has provided different values
                    url: this.apiUrl,
                    stream: this.useStream,
                    headers: this.customHeaders,
                },
                this.useWebSocket, // Pass WebSocket flag
                this.apiUrl // Pass WebSocket URL (same as API URL)
            );

            // Ensure auto-scrolling is working after starting the response
            setTimeout(() => {
                const chatThreadComponent = this.renderRoot?.querySelector('chat-thread-component');
                if (chatThreadComponent && typeof (chatThreadComponent as any).ensureAutoScroll === 'function') {
                    (chatThreadComponent as any).ensureAutoScroll();
                }
            }, 100);
        } catch (error) {
            // If there's an error during the submission process, make sure to clear the loading state
            console.error('Error during chat submission:', error);
            this.dispatchEvent(new CustomEvent('popup:show', {
                detail: {
                    message: 'file.upload.error.submission_failed',
                    type: 'error',
                    params: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                },
                bubbles: true,
                composed: true
            }));
            this.chatController.isAwaitingResponse = false;
        }
    }
}