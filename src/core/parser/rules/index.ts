// Base rule and interfaces
export { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';

// Rule implementations
import { HeaderRule } from './header-rule';
import { CodeBlockRule } from './code-block-rule';
import { TextFormattingRule } from './text-formatting-rule';
import { LineBreakRule } from './line-break-rule';
import { LinkRule } from './link-rule';
import { ListRule } from './list-rule';
import { BufferingRule } from './base-rule';

const ruleList: typeof BufferingRule[] = [
    LinkRule,
    ListRule,
    LineBreakRule,
    TextFormattingRule,
    CodeBlockRule,
    HeaderRule
];

export {
    ruleList,
    LinkRule,
    ListRule,
    LineBreakRule,
    TextFormattingRule,
    CodeBlockRule,
    HeaderRule
}