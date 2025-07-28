import { BufferState } from './bufferer';
import { 
  BufferingRule,
  H3HeaderRule,
  H2HeaderRule,
  H1HeaderRule,
  CodeBlockRule,
  BoldTextRule,
  LineBreakRule,
  LinkRule,
  ListRule
} from './rules';

export class BufferingRuleManager {
  private rules: BufferingRule[] = [];

  constructor(customRules?: BufferingRule[]) {
    if (customRules) {
      this.rules = [...customRules];
    } else {
      this.initializeDefaultRules();
    }
    this.sortRulesByPriority();
  }

  private initializeDefaultRules(): void {
    this.rules = [
      new H3HeaderRule(),
      new H2HeaderRule(),
      new H1HeaderRule(),
      new CodeBlockRule(),
      new BoldTextRule(),
      new ListRule(),
      new LineBreakRule(),
      new LinkRule()
    ];
  }

  private sortRulesByPriority(): void {
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add a new rule to the manager
   */
  addRule(rule: BufferingRule): void {
    this.rules.push(rule);
    this.sortRulesByPriority();
  }

  /**
   * Remove a rule by name
   */
  removeRule(name: string): boolean {
    const index = this.rules.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Process a chunk and apply the first matching buffering rule
   */
  processChunk(
    chunk: string,
    bufferState: BufferState
  ): { processedChunk: string | null; bufferState: BufferState; ruleApplied?: string } | null {
    if (bufferState.buffering) {
      return null; // Already buffering, let the existing logic handle it
    }

    for (const rule of this.rules) {
      // Skip line break rule if we're in a linebreakProof context (code-viewer or list-viewer)
      if (rule.name === 'line-break' && bufferState.linebreakProof) {
        continue;
      }
      
      if (rule.detect(chunk, bufferState)) {
        // Try to complete immediately if possible
        const completeMatch = rule.tryCompleteMatch(chunk, bufferState);
        if (completeMatch) {
          return {
            processedChunk: chunk.replace(completeMatch.fullMatch, completeMatch.replacement),
            bufferState,
            ruleApplied: rule.name
          };
        }

        // Start buffering
        const bufferingResult = rule.startBuffering(chunk, bufferState);
        bufferState.buffering = true;
        bufferState.bufferingFinisher = bufferingResult.finisher;
        bufferState.bufferingClosure = bufferingResult.closure;
        bufferState.bufferText = bufferState.bufferText || ''; // Initialize bufferText if not set
        
        // Special handling for code blocks
        if (rule.name === 'code-block') {
          bufferState.skipOne = true;
          bufferState.insideCodeViewer = true;
          bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
          bufferState.linebreakProof = true; // Code blocks are linebreak proof
        }

        // Special handling for lists
        if (rule.name === 'list') {
          bufferState.insideListViewer = true;
          bufferState.listViewerDepth = (bufferState.listViewerDepth || 0) + 1;
          bufferState.linebreakProof = true; // Lists are linebreak proof
        }

        return {
          processedChunk: bufferingResult.processedChunk, // Return the processed chunk immediately
          bufferState,
          ruleApplied: rule.name
        };
      }
    }

    return null; // No rule matched
  }

  /**
   * Process full text using all rules (for non-streaming scenarios)
   */
  processFullText(text: string): string {
    let processedText = text;
    
    // Process rules in priority order (lower number = higher priority)
    for (const rule of this.rules) {
      processedText = rule.processFullText(processedText);
    }
    
    return processedText;
  }

  /**
   * Get all rule names for debugging
   */
  getRuleNames(): string[] {
    return this.rules.map(rule => rule.name);
  }

  /**
   * Get rule by name for debugging
   */
  getRule(name: string): BufferingRule | undefined {
    return this.rules.find(rule => rule.name === name);
  }

  /**
   * Get all rules (for advanced usage)
   */
  getAllRules(): BufferingRule[] {
    return [...this.rules];
  }
}
