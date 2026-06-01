import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAxeResults, filterForMode } from './axe.js'

const makeViolation = (overrides = {}) => ({
  help: 'Image must have alternate text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
  description: 'Ensures <img> elements have alternate text or a role of none or presentation',
  impact: 'critical',
  tags: ['wcag2a', 'wcag111', 'cat.text-alternatives'],
  nodes: [{ target: ['img.hero'], failureSummary: 'Add an alt attribute' }],
  ...overrides,
})

test('maps critical impact to critical severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'critical' })])
  assert.equal(result[0].severity, 'critical')
})

test('maps serious impact to critical severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'serious' })])
  assert.equal(result[0].severity, 'critical')
})

test('maps moderate impact to warning severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'moderate' })])
  assert.equal(result[0].severity, 'warning')
})

test('maps minor impact to info severity', () => {
  const result = normalizeAxeResults([makeViolation({ impact: 'minor' })])
  assert.equal(result[0].severity, 'info')
})

test('extracts WCAG criterion from tags', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2a', 'wcag111'] })])
  assert.equal(result[0].wcag, '1.1.1')
})

test('extracts level A from wcag2a tag', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2a', 'wcag111'] })])
  assert.equal(result[0].level, 'A')
})

test('extracts level AA from wcag2aa tag', () => {
  const result = normalizeAxeResults([makeViolation({ tags: ['wcag2aa', 'wcag143'] })])
  assert.equal(result[0].level, 'AA')
})

test('uses first node target as selector', () => {
  const result = normalizeAxeResults([makeViolation()])
  assert.equal(result[0].selector, 'img.hero')
})

test('counts occurrences from nodes array length', () => {
  const v = makeViolation()
  v.nodes = [{ target: ['img.a'], failureSummary: '' }, { target: ['img.b'], failureSummary: '' }]
  const result = normalizeAxeResults([v])
  assert.equal(result[0].occurrences, 2)
})

test('tags source as axe-core', () => {
  const result = normalizeAxeResults([makeViolation()])
  assert.equal(result[0].source, 'axe-core')
})

test('filterForMode keeps all violations in page mode', () => {
  const violations = [{ id: 'html-has-lang' }, { id: 'image-alt' }, { id: 'document-title' }]
  assert.equal(filterForMode(violations, 'page').length, 3)
})

test('filterForMode removes document-level rules in component mode', () => {
  const violations = [{ id: 'html-has-lang' }, { id: 'image-alt' }, { id: 'document-title' }, { id: 'region' }]
  const result = filterForMode(violations, 'component')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'image-alt')
})

test('filterForMode removes all known document-level rule IDs in component mode', () => {
  const docRules = ['html-has-lang', 'html-xml-lang-mismatch', 'document-title', 'page-has-heading-one', 'region', 'landmark-one-main', 'bypass']
  const violations = docRules.map(id => ({ id }))
  assert.equal(filterForMode(violations, 'component').length, 0)
})
