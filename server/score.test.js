import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAndScore } from './score.js'

const makeViolation = (overrides = {}) => ({
  id: 'v1',
  severity: 'critical',
  rule: 'Test rule',
  wcag: '1.1.1',
  level: 'A',
  selector: 'img',
  occurrences: 1,
  impact: 'Serious',
  desc: 'Test description',
  fix: 'Test fix',
  link: 'https://example.com',
  source: 'axe-core',
  ...overrides,
})

const baseCtx = { url: 'https://example.com', elementsScanned: 100, durationMs: 1000 }

test('returns Level AA conformance for zero violations', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.conformance, 'Level AA')
})

test('returns Non-conformant when Level A critical violation present', () => {
  const result = mergeAndScore([makeViolation({ level: 'A', severity: 'critical' })], [], baseCtx)
  assert.equal(result.conformance, 'Non-conformant')
})

test('returns Level A when only AA violations present', () => {
  const result = mergeAndScore([makeViolation({ level: 'AA', severity: 'warning' })], [], baseCtx)
  assert.equal(result.conformance, 'Level A')
})

test('returns Level AA when only info violations present', () => {
  const result = mergeAndScore([makeViolation({ level: 'AA', severity: 'info' })], [], baseCtx)
  assert.equal(result.conformance, 'Level AA')
})

test('deduplicates by wcag + selector, keeps axe entry', () => {
  const axe = [makeViolation({ id: 'axe-0', source: 'axe-core', fix: 'short axe fix' })]
  const claude = [makeViolation({ id: 'c-0', source: 'claude', fix: 'much longer claude fix with more detail' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.equal(result.violations.length, 1)
  assert.equal(result.violations[0].source, 'axe-core')
})

test('replaces axe fix with Claude fix when Claude fix is longer', () => {
  const axe = [makeViolation({ source: 'axe-core', fix: 'short' })]
  const claude = [makeViolation({ source: 'claude', fix: 'a much longer and more helpful fix suggestion for the developer' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.ok(result.violations[0].fix.length > 10)
})

test('keeps non-overlapping Claude violations', () => {
  const axe = [makeViolation({ wcag: '1.1.1', selector: 'img' })]
  const claude = [makeViolation({ wcag: '2.4.4', selector: 'a.more', source: 'claude' })]
  const result = mergeAndScore(axe, claude, baseCtx)
  assert.equal(result.violations.length, 2)
})

test('includes url in result', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.url, 'https://example.com')
})

test('includes elementsScanned in result', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.elementsScanned, 100)
})
