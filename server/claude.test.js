import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preprocessHtml } from './claude.js'

test('strips script tags and their content', () => {
  const html = '<body><script>alert(1)</script><p>hello</p></body>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('<script>'))
  assert.ok(!result.includes('alert(1)'))
  assert.ok(result.includes('<p>hello</p>'))
})

test('strips style tags and their content', () => {
  const html = '<head><style>body{color:red}</style></head><body></body>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('<style>'))
  assert.ok(!result.includes('color:red'))
})

test('strips inline event handlers', () => {
  const html = '<button onclick="doThing()">Click</button>'
  const result = preprocessHtml(html)
  assert.ok(!result.includes('onclick'))
  assert.ok(result.includes('<button'))
  assert.ok(result.includes('Click'))
})

test('truncates to 15000 characters', () => {
  const html = 'x'.repeat(20_000)
  const result = preprocessHtml(html)
  assert.equal(result.length, 15_000)
})

test('does not truncate html shorter than 15000 chars', () => {
  const html = '<p>short</p>'
  const result = preprocessHtml(html)
  assert.equal(result, html)
})
