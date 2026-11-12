import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')

// A helper that declares `children` as a fixed positional parameter silently
// drops every child after the first when a caller passes several children.
// This bit the settings page once: `group(title, hint, row1, row2, ...)`
// rendered only row1 and the display options disappeared from the page.
test('render helpers never take children as a fixed positional parameter', () => {
  const offenders = []
  const pattern = /\(([^()]*\bchildren\b[^()]*)\)\s*=>/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    const params = match[1].split(',').map((part) => part.trim())
    if (!params.includes('...children')) offenders.push(params.join(', '))
  }
  assert.deepEqual(offenders, [])
})

test('the settings group helper forwards every child', () => {
  const match = source.match(/const group = \(([^)]*)\) =>/)
  assert.ok(match, 'group helper is declared')
  assert.equal(match[1].trim(), 'title, description, ...children')
})
