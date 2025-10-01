import { BufferState } from './bufferer';
import { 
  BufferingRule,
  HeaderRule,
  CodeBlockRule,
  BoldTextRule,
  ItalicTextRule,
  LineBreakRule,  
  // ListRule
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
      new HeaderRule(),
      new BoldTextRule(),
      new ItalicTextRule(),
      new CodeBlockRule(),
      new LineBreakRule()
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
   * Process a chunk and apply all applicable rules in priority order
   * Each rule gets the processed content from previous rules
   * 
   * Rules that can complete immediately (like headers, bold, italic) are applied sequentially.
   * When a rule requires buffering (like code blocks), processing stops and buffering begins.
   * This ensures that a chunk like "**bold text** ```javascript" will:
   * 1. First apply bold formatting to get "**bold text** ```javascript"
   * 2. Then detect code block and start buffering
   */
  processChunk(
    chunk: string,
    bufferState: BufferState
  ): { processedChunk: string | null; bufferState: BufferState; ruleApplied?: string } | null {
    
    if (bufferState.buffering) {
      
      // If in exclusive buffering mode (code-block), only allow the buffering rule to process
      if (bufferState.ruleProcessingMode === 'buffering-exclusive') {
        return null; // Block all rule processing during exclusive buffering
      }
      
      // In sequential mode, check if any rules are allowed during buffering
      if (bufferState.allowedRulesWhileBuffering && bufferState.allowedRulesWhileBuffering.length > 0) {
        // Continue with limited rule processing
      } else {
        return null; // No rules allowed during buffering
      }
    }

    let currentChunk = chunk;
    let hasAppliedRule = false;
    let appliedRuleName: string | undefined;

    // Get rules to process based on current state
    let rulesToProcess = this.rules;
    
    // Process ALL rules sequentially - each rule gets the processed content from previous rules
    for (const rule of rulesToProcess) {
      
      // Skip line break rule if we're in a linebreakProof context
      if (rule.name === 'line-break' && bufferState.linebreakProof) {
        continue;
      }

      const ruleDetected = rule.detect(currentChunk, bufferState);
      
      if (ruleDetected === true) {
        // Try to complete immediately if possible
        const completeMatch = rule.tryCompleteMatch(currentChunk, bufferState);
        if (completeMatch) {
          // For text formatting rules, apply all instances using processFullText
          if (rule.name === 'bold-text' || rule.name === 'italic-text') {
            currentChunk = rule.processFullText(currentChunk);
          } else {
            currentChunk = currentChunk.replace(completeMatch.fullMatch, completeMatch.replacement);
          }
          hasAppliedRule = true;
          appliedRuleName = rule.name;
          // Continue to check next rules with the processed content
        } else {
          // Rule requires buffering - start buffering immediately
          const bufferingResult = rule.startBuffering(currentChunk, bufferState);
          bufferState.buffering = true;
          bufferState.bufferingFinisher = bufferingResult.finisher || null;
          bufferState.bufferingClosure = bufferingResult.closure;
          bufferState.bufferText = bufferState.bufferText || '';

          // Set rule processing mode based on the rule's configuration
          if (rule.exclusiveBuffering) {
            this.setRuleProcessingMode(
              bufferState,
              'buffering-exclusive',
              rule.name,
              rule.allowedRulesWhileBuffering
            );
          } else {
            // Default to sequential processing
            this.setRuleProcessingMode(bufferState, 'sequential');
          }

          // Special handling for code blocks
          if (rule.name === 'code-block') {
            bufferState.skipOne = true;
            bufferState.insideCodeViewer = true;
            bufferState.codeViewerDepth = (bufferState.codeViewerDepth || 0) + 1;
            bufferState.linebreakProof = true;
          }

          // Special handling for lists
          if (rule.name === 'list') {
            bufferState.insideListViewer = true;
            bufferState.listViewerDepth = (bufferState.listViewerDepth || 0) + 1;
            bufferState.linebreakProof = true;
          }

          return {
            processedChunk: bufferingResult.processedChunk,
            bufferState,
            ruleApplied: rule.name
          };
        }
      } else if (ruleDetected === null) {
        // checking on composite detection chunks
        return {
          processedChunk: '', 
          bufferState
        };        
      }
    }

    // If we applied immediate rules, return the processed chunk
    if (hasAppliedRule) {
      return {
        processedChunk: currentChunk,
        bufferState,
        ruleApplied: appliedRuleName
      };
    }

    return null; // No rule matched
  }

  /**
   * Continue buffering with rule-specific logic
   */
  continueBuffering(
    chunk: string,
    bufferState: BufferState,
    ruleApplied: string
  ): { processedChunk: string | null; shouldContinue: boolean } | null {
    const rule = this.getRule(ruleApplied);
    if (!rule) {
      return null;
    }

    // Try rule-specific continuation logic first
    const continueResult = rule.continueBuffering(
      chunk,
      bufferState.bufferText,
      bufferState.bufferingFinisher || '',
      bufferState.bufferingClosure || '',
      bufferState
    );

    if (continueResult) {
      // Update buffer state based on rule result
      bufferState.bufferingFinisher = continueResult.finisher;
      bufferState.bufferingClosure = continueResult.closure;
      
      return {
        processedChunk: continueResult.processedChunk,
        shouldContinue: true
      };
    }

    return null; // Rule doesn't handle continuation
  }

  /**
   * Handle completion with rule-specific logic
   */
  handleCompletion(
    chunk: string,
    bufferState: BufferState,
    ruleApplied: string
  ): { finalChunk: string; remainingChunk: string; shouldReset: boolean } | null {
    const rule = this.getRule(ruleApplied);
    if (!rule) {
      return null;
    }

    // Try rule-specific completion logic first
    const completionResult = rule.handleBufferingCompletion(
      chunk,
      bufferState.bufferText,
      bufferState.bufferingFinisher || '',
      bufferState.bufferingClosure || '',
      bufferState
    );

    if (completionResult) {
      return {
        finalChunk: completionResult.finalChunk,
        remainingChunk: completionResult.remainingChunk,
        shouldReset: !completionResult.shouldContinue
      };
    }

    return null; // Rule doesn't handle completion
  }

  /**
   * Process content for buffering using rule-specific logic
   */
  processContentForBuffer(content: string, ruleApplied: string): string {
    const rule = this.getRule(ruleApplied);
    if (!rule) {
      return content;
    }

    return rule.processBufferContent(content);
  }

  /**
   * Check if buffering should finish using rule-specific logic when no finisher is set
   */
  detectFinish(
    chunk: string,
    bufferState: BufferState,
    ruleApplied: string
  ): boolean | null {
    const rule = this.getRule(ruleApplied);
    if (!rule) {
      return false;
    }

    return rule.detectFinish(chunk, bufferState.bufferText, bufferState);
  }

  /**
   * Process full text using all rules sequentially in priority order
   * Each rule processes the output from the previous rule
   */
  processFullText(text: string): string {
    let processedText = text;
    
    // Process rules in priority order (lower number = higher priority)
    // Each rule gets the processed content from previous rules
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

  /**
   * Set rule processing mode for buffering
   */
  setRuleProcessingMode(
    bufferState: BufferState,
    mode: 'sequential' | 'buffering-exclusive',
    exclusiveRule?: string,
    allowedRules?: string[]
  ): void {
    bufferState.ruleProcessingMode = mode;
    
    if (mode === 'buffering-exclusive') {
      bufferState.exclusiveBufferingRule = exclusiveRule;
      bufferState.allowedRulesWhileBuffering = allowedRules || [];
    } else {
      // Reset exclusive mode settings
      bufferState.exclusiveBufferingRule = undefined;
      bufferState.allowedRulesWhileBuffering = undefined;
    }
  }

  /**
   * Reset rule processing mode to sequential
   */
  resetRuleProcessingMode(bufferState: BufferState): void {
    bufferState.ruleProcessingMode = 'sequential';
    bufferState.exclusiveBufferingRule = undefined;
    bufferState.allowedRulesWhileBuffering = undefined;
  }
}
