import { ChatComponent } from "../components/chat-component";
import { normalizeSync } from 'normalize-diacritics';

export interface KeyboardShortcut {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    description: string;
    action: () => void;
}

export class KeyboardShortcutsHelper {
    private static shortcuts: Map<string, KeyboardShortcut> = new Map();
    private static isListening = false;

    /**
     * Initialize keyboard shortcuts for the chat component
     */
    static initializeShortcuts(this: ChatComponent) {
        if (KeyboardShortcutsHelper.isListening) {
            return;
        }

        KeyboardShortcutsHelper.registerShortcuts.bind(this)();
        KeyboardShortcutsHelper.startListening();
    }

    /**
     * Register all available keyboard shortcuts
     */
    private static registerShortcuts(this: ChatComponent) {
        const shortcuts: KeyboardShortcut[] = [
            {
                key: 'k',
                ctrlKey: true,
                altKey: true,
                description: 'Open Knowledge Picker',
                action: () => {
                    // Trigger knowledge picker - you may need to implement this functionality
                    this.aiAssistantSignal?.setValue({
                        command: 'open_knowledge_picker'
                    })
                }
            },
            {
                key: 'n',
                ctrlKey: true,
                altKey: true,
                description: 'Add New Knowledge',
                action: () => {
                    // Trigger add new knowledge - you may need to implement this functionality
                     this.aiAssistantSignal?.setValue({
                        command: 'open_knowledge_picker_create_form'
                    })
                }
            },
            {
                key: 's',
                ctrlKey: true,
                altKey: true,
                description: 'Open Settings',
                action: () => {
                    this.handleSettingsExpandAside();
                }
            },
            {
                key: 'f',
                ctrlKey: true,
                altKey: true,
                description: 'Toggle Web Search',
                action: () => {
                    this.webSearchEnabled = !this.webSearchEnabled;
                    
                    // Dispatch event to notify about web search toggle
                    this.dispatchEvent(new CustomEvent('keyboard:web-search-toggle', {
                        detail: { enabled: this.webSearchEnabled },
                        bubbles: true,
                        composed: true
                    }));
                }
            },
            {
                key: 'p',
                ctrlKey: true,
                altKey: true,
                description: 'Toggle Advanced Prompts (Slot Structure)',
                action: () => {
                    this.advancedPromptingEnabled = !this.advancedPromptingEnabled;
                    
                    // Dispatch event to notify about advanced prompts toggle
                    this.dispatchEvent(new CustomEvent('keyboard:advanced-prompts-toggle', {
                        detail: { enabled: this.advancedPromptingEnabled },
                        bubbles: true,
                        composed: true
                    }));
                }
            }
        ];

        // Clear existing shortcuts and register new ones
        KeyboardShortcutsHelper.shortcuts.clear();
        
        shortcuts.forEach(shortcut => {
            const key = KeyboardShortcutsHelper.generateShortcutKey(shortcut);
            KeyboardShortcutsHelper.shortcuts.set(key, shortcut);
        });
    }

    /**
     * Generate a unique key string for the shortcut
     */
    private static generateShortcutKey(shortcut: KeyboardShortcut): string {
        const modifiers: string[] = [];
        if (shortcut.ctrlKey) modifiers.push('ctrl');
        if (shortcut.altKey) modifiers.push('alt');
        if (shortcut.shiftKey) modifiers.push('shift');
        if (shortcut.metaKey) modifiers.push('meta');
        
        return [...modifiers, normalizeSync(shortcut.key.toLowerCase())].join('+');
    }

    /**
     * Start listening for keyboard events
     */
    private static startListening() {
        if (KeyboardShortcutsHelper.isListening) {
            return;
        }

        document.addEventListener('keydown', KeyboardShortcutsHelper.handleKeydown);
        KeyboardShortcutsHelper.isListening = true;
    }

    /**
     * Stop listening for keyboard events
     */
    static stopListening() {
        if (!KeyboardShortcutsHelper.isListening) {
            return;
        }

        document.removeEventListener('keydown', KeyboardShortcutsHelper.handleKeydown);
        KeyboardShortcutsHelper.isListening = false;
        KeyboardShortcutsHelper.shortcuts.clear();
    }

    /**
     * Handle keydown events and execute shortcuts
     */
    private static handleKeydown(event: KeyboardEvent) {
        // Ignore shortcuts when user is typing in input fields
        const activeElement = document.activeElement;
        const isInputField = activeElement instanceof HTMLInputElement || 
                            activeElement instanceof HTMLTextAreaElement || 
                            activeElement?.getAttribute('contenteditable') === 'true';
        if (isInputField) {
            return;
        }



        const shortcutKey = KeyboardShortcutsHelper.generateShortcutKey({
            key: event.key,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            description: '',
            action: () => {}
        });

        const shortcut = KeyboardShortcutsHelper.shortcuts.get(shortcutKey);

        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            shortcut.action();
        }
    }

    /**
     * Get all registered shortcuts for display purposes
     */
    static getShortcuts(): KeyboardShortcut[] {
        return Array.from(KeyboardShortcutsHelper.shortcuts.values());
    }

    /**
     * Get formatted shortcut display string
     */
    static getShortcutDisplayString(shortcut: KeyboardShortcut): string {
        const modifiers: string[] = [];
        if (shortcut.ctrlKey) modifiers.push('Ctrl');
        if (shortcut.altKey) modifiers.push('Alt');
        if (shortcut.shiftKey) modifiers.push('Shift');
        if (shortcut.metaKey) modifiers.push('Cmd');
        
        const key = shortcut.key === ' ' ? 'Space' : 
                   shortcut.key.length === 1 ? shortcut.key.toUpperCase() : 
                   shortcut.key;
        
        return [...modifiers, key].join(' + ');
    }
}