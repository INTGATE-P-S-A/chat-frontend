import { ChatComponent } from "../components/chat-component";

export class FilesHelper {
    static MB = 1024 * 1024;

    static MAX_FILE_SIZE = 2 * FilesHelper.MB; // 2MB per file
    static MAX_TOTAL_SIZE = 5 * FilesHelper.MB; // 5MB total

    static fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    // Remove the data URL prefix to get just the base64 string
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to read file as base64'));
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    static formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static removeFile(this: ChatComponent, index: number): void {
        this.promptFiles = this.promptFiles.filter((_, i) => i !== index);
    }

    static async uploadFiles(this: ChatComponent, files: MessageFile[]): Promise<{ success: boolean; files: any[] }> {
        try {
            const fileData = files.map(file => ({
                name: file.filename,
                type: file.mimeType,
                base64: file.base64
            }));

            const response = await fetch(`${this.apiUrl}/upload-file`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.customHeaders
                },
                body: JSON.stringify({ files: fileData })
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            return { success: false, files: [] };
        }
    }

    static async onPaste(this: ChatComponent, e: ClipboardEvent) {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
        const imageFiles: File[] = [];

        // Check for image items in clipboard
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    imageFiles.push(file);
                }
            }
        }

        // Process detected image files
        if (imageFiles.length > 0) {
            e.preventDefault(); // Prevent default paste behavior for images
            await FilesHelper.processFiles.bind(this)(imageFiles);
        }
    }

    /**
     * Handle drop event to process dropped files
     */
    static async onDrop(this: ChatComponent, e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();

        this.isDragOver = false;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        // Filter for supported file types
        const supportedFiles = Array.from(files).filter(file => {
            return file.type.startsWith('image/') ||
                file.type === 'application/pdf' ||
                file.type === 'text/plain' ||
                file.type === 'text/markdown' ||
                file.type.includes('document') ||
                file.type.includes('text') ||
                file.type === 'application/zip' ||
                file.type === 'application/x-zip-compressed' ||
                file.type.includes('compressed') ||
                file.type.includes('archive') ||
                file.type.includes('excel') ||
                file.type.includes('spreadsheet') ||
                file.type === 'application/vnd.ms-excel' ||
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.type.includes('powerpoint') ||
                file.type.includes('presentation') ||
                file.type === 'audio/mp3' ||
                file.type === 'audio/mpeg';
        });

        if (supportedFiles.length > 0) {
            await FilesHelper.processFiles.bind(this)(supportedFiles);
        } else if (files.length > 0) {
            // Show error for unsupported file types
            this.dispatchEvent(new CustomEvent('popup:show', {
                detail: {
                    message: 'file.upload.error.unsupported_type',
                    type: 'error'
                },
                bubbles: true,
                composed: true
            }));
        }
    }

    /**
     * Handle drag over event specifically for the form area
     */
    static onFormDragOver(this: ChatComponent, e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();

        // Check if dragged items contain files
        if (e.dataTransfer?.types.includes('Files')) {
            this.isDragOver = true;
        }
    }

    /**
     * Handle drag leave event specifically for the form area
     */
    static onFormDragLeave(this: ChatComponent, e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();

        // Check if we're actually leaving the form container
        const form = this.renderRoot?.querySelector('#chat-form');
        if (form && e.relatedTarget && !form.contains(e.relatedTarget as Node)) {
            this.isDragOver = false;
        }
    }

    static async processFiles(this: ChatComponent, files: File[]): Promise<void> {
        // Calculate current total size
        const currentTotalSize = this.promptFiles.reduce((total, file) => total + file.size, 0);

        let newFilesTotalSize = 0;

        for (const file of files) {
            try {
                // Check if this is an image file larger than 5MB
                if (file.type.startsWith('image/') && file.size > 5 * FilesHelper.MB) {
                    this.dispatchEvent(new CustomEvent('popup:show', {
                        detail: {
                            message: 'file.upload.error.image_too_large',
                            type: 'error',
                            params: {
                                filename: file.name,
                                size: FilesHelper.formatFileSize(file.size),
                                maxSize: '5MB'
                            }
                        },
                        bubbles: true,
                        composed: true
                    }));
                    continue; // Skip this file and continue with others
                }

                // Check individual file size for non-image files or smaller images
                if (file.size > FilesHelper.MAX_FILE_SIZE) {
                    // Convert file to base64 for potential knowledge base upload
                    const base64 = await FilesHelper.fileToBase64(file);
                    
                    this.dispatchEvent(new CustomEvent('big_file:confirm:kdb', {
                        detail: {                      
                            payload: {
                                    title: file.name,
                                    content: base64,
                                    mimeType: file.type,
                                    originalName: file.name,
                                    size: file.size,
                                    isBase64Content: true, // Flag to indicate base64 content for file upload
                                    contentType: 'file' // Specify this is file content, not text
                            }
                        },
                        bubbles: true,
                        composed: true
                    }));
                    continue;
                }

                // Check total size limit including all new files
                if (currentTotalSize + newFilesTotalSize + file.size > FilesHelper.MAX_TOTAL_SIZE) {
                    this.dispatchEvent(new CustomEvent('popup:show', {
                        detail: {
                            message: 'file.upload.error.total_size_exceeded',
                            type: 'error',
                            params: {
                                currentSize: FilesHelper.formatFileSize(currentTotalSize),
                                newSize: FilesHelper.formatFileSize(newFilesTotalSize + file.size)
                            }
                        },
                        bubbles: true,
                        composed: true
                    }));
                    break; // Stop processing remaining files
                }

                newFilesTotalSize += file.size;

                // Convert file to base64
                const base64 = await FilesHelper.fileToBase64(file);

                // Create file object
                const fileObject: MessageFile = {
                    id: crypto.randomUUID(),
                    filename: file.name,
                    originalName: file.name,
                    size: file.size,
                    mimeType: file.type,
                    base64: base64,
                    tmp: true
                };

                // Add to promptFiles array
                this.promptFiles = [...this.promptFiles, fileObject];

            } catch (error) {
                this.dispatchEvent(new CustomEvent('popup:show', {
                    detail: {
                        message: 'file.upload.error.processing_failed',
                        type: 'error',
                        params: {
                            fileName: file.name,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        }
    }

    static handleAddFile(this: ChatComponent, event?: Event) {
        // Prevent form submission
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt,.md,.zip,.tar,.tar.gz,.bz2,.xls,.xlsx,.ppt,.pptx,.mp3';
        fileInput.multiple = true;

        // Handle file selection
        fileInput.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            const files = target.files;

            if (!files || files.length === 0) return;

            await FilesHelper.processFiles.bind(this)(Array.from(files));
        });

        // Trigger the file picker
        fileInput.click();
    }
}