// Base rule and interfaces
export { BufferingRule, CompleteMatchResult, BufferingResult, FullTextResult } from './base-rule';

// Rule implementations
import { H3HeaderRule } from './h3-header-rule';
import { H2HeaderRule } from './h2-header-rule';
import { H1HeaderRule } from './h1-header-rule';
import { CodeBlockRule } from './code-block-rule';
import { BoldTextRule } from './bold-text-rule';
import { LineBreakRule } from './line-break-rule';
import { LinkRule } from './link-rule';
import { ListRule } from './list-rule';
import { BufferingRule } from './base-rule';

const ruleList: typeof BufferingRule[] = [
    LinkRule,
    ListRule,
    LineBreakRule,
    BoldTextRule,
    CodeBlockRule,
    H1HeaderRule,
    H2HeaderRule,
    H3HeaderRule
];

export {
    ruleList,
    LinkRule,
    ListRule,
    LineBreakRule,
    BoldTextRule,
    CodeBlockRule,
    H1HeaderRule,
    H2HeaderRule,
    H3HeaderRule
}