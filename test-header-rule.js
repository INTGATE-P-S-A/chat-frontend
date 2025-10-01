// Test the unified header rule
import { HeaderRule } from '../src/core/parser/rules/header-rule';

const headerRule = new HeaderRule();

// Test header detection
console.log('Testing header detection:');

const testCases = [
  '# This is H1',
  '## This is H2', 
  '### This is H3',
  '#### This is H4',
  '##### This is H5',
  '###### This is H6',
  'No header here',
  'Some text ### Krok 2: Struktura HTML i CSS more text'
];

testCases.forEach((testCase, index) => {
  console.log(`\nTest case ${index + 1}: "${testCase}"`);
  
  const detection = headerRule.detect(testCase);
  console.log('Detection result:', detection);
  
  if (detection) {
    const match = headerRule.tryCompleteMatch(testCase);
    console.log('Complete match:', match);
  }
});