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

test('returns grade A and score 100 for zero violations', () => {
  const result = mergeAndScore([], [], baseCtx)
  assert.equal(result.grade, 'A')
  assert.equal(result.score, 100)
})

test('deducts 10 for each critical violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'critical' })], [], baseCtx)
  assert.equal(result.score, 90)
})

test('deducts 4 for each warning violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'warning' })], [], baseCtx)
  assert.equal(result.score, 96)
})

test('deducts 1 for each info violation', () => {
  const result = mergeAndScore([makeViolation({ severity: 'info' })], [], baseCtx)
  assert.equal(result.score, 99)
})

test('score floors at 0', () => {
  const violations = Array.from({ length: 15 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.score, 0)
})

test('grade C for score 60-74', () => {
  const violations = Array.from({ length: 4 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.grade, 'C') // 100 - 40 = 60 → C
})

test('grade F for score below 40', () => {
  const violations = Array.from({ length: 7 }, (_, i) =>
    makeViolation({ wcag: `1.1.${i}`, selector: `el-${i}` })
  )
  const result = mergeAndScore(violations, [], baseCtx)
  assert.equal(result.grade, 'F') // 100 - 70 = 30 → F
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
