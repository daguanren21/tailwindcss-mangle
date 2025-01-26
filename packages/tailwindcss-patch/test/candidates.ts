import type { Candidate, Variant } from '../../../tailwindcss/src/candidate'
import type { DesignSystem } from '../../../tailwindcss/src/design-system'
import { Scanner } from '@tailwindcss/oxide'
import * as ValueParser from './src/value-parser'

export async function extractRawCandidates(
  content: string,
  extension: string = 'html',
): Promise<{ rawCandidate: string, start: number, end: number }[]> {
  const scanner = new Scanner({})
  const result = scanner.getCandidatesWithPositions({ content, extension })

  const candidates: { rawCandidate: string, start: number, end: number }[] = []
  for (const { candidate: rawCandidate, position: start } of result) {
    candidates.push({ rawCandidate, start, end: start + rawCandidate.length })
  }
  return candidates
}

export function printCandidate(designSystem: DesignSystem, candidate: Candidate) {
  const parts: string[] = []

  for (const variant of candidate.variants) {
    parts.unshift(printVariant(variant))
  }

  // Handle prefix
  if (designSystem.theme.prefix) {
    parts.unshift(designSystem.theme.prefix)
  }

  let base: string = ''

  // Handle static
  if (candidate.kind === 'static') {
    base += candidate.root
  }

  // Handle functional
  if (candidate.kind === 'functional') {
    base += candidate.root

    if (candidate.value) {
      if (candidate.value.kind === 'arbitrary') {
        if (candidate.value !== null) {
          const isVarValue = isVar(candidate.value.value)
          const value = isVarValue ? candidate.value.value.slice(4, -1) : candidate.value.value
          const [open, close] = isVarValue ? ['(', ')'] : ['[', ']']

          if (candidate.value.dataType) {
            base += `-${open}${candidate.value.dataType}:${printArbitraryValue(value)}${close}`
          }
          else {
            base += `-${open}${printArbitraryValue(value)}${close}`
          }
        }
      }
      else if (candidate.value.kind === 'named') {
        base += `-${candidate.value.value}`
      }
    }
  }

  // Handle arbitrary
  if (candidate.kind === 'arbitrary') {
    base += `[${candidate.property}:${printArbitraryValue(candidate.value)}]`
  }

  // Handle modifier
  if (candidate.kind === 'arbitrary' || candidate.kind === 'functional') {
    if (candidate.modifier) {
      const isVarValue = isVar(candidate.modifier.value)
      const value = isVarValue ? candidate.modifier.value.slice(4, -1) : candidate.modifier.value
      const [open, close] = isVarValue ? ['(', ')'] : ['[', ']']

      if (candidate.modifier.kind === 'arbitrary') {
        base += `/${open}${printArbitraryValue(value)}${close}`
      }
      else if (candidate.modifier.kind === 'named') {
        base += `/${candidate.modifier.value}`
      }
    }
  }

  // Handle important
  if (candidate.important) {
    base += '!'
  }

  parts.push(base)

  return parts.join(':')
}

function printVariant(variant: Variant) {
  // Handle static variants
  if (variant.kind === 'static') {
    return variant.root
  }

  // Handle arbitrary variants
  if (variant.kind === 'arbitrary') {
    return `[${printArbitraryValue(simplifyArbitraryVariant(variant.selector))}]`
  }

  let base: string = ''

  // Handle functional variants
  if (variant.kind === 'functional') {
    base += variant.root
    if (variant.value) {
      if (variant.value.kind === 'arbitrary') {
        const isVarValue = isVar(variant.value.value)
        const value = isVarValue ? variant.value.value.slice(4, -1) : variant.value.value
        const [open, close] = isVarValue ? ['(', ')'] : ['[', ']']

        base += `-${open}${printArbitraryValue(value)}${close}`
      }
      else if (variant.value.kind === 'named') {
        base += `-${variant.value.value}`
      }
    }
  }

  // Handle compound variants
  if (variant.kind === 'compound') {
    base += variant.root
    base += '-'
    base += printVariant(variant.variant)
  }

  // Handle modifiers
  if (variant.kind === 'functional' || variant.kind === 'compound') {
    if (variant.modifier) {
      if (variant.modifier.kind === 'arbitrary') {
        base += `/[${printArbitraryValue(variant.modifier.value)}]`
      }
      else if (variant.modifier.kind === 'named') {
        base += `/${variant.modifier.value}`
      }
    }
  }

  return base
}

function printArbitraryValue(input: string) {
  const ast = ValueParser.parse(input)

  const drop = new Set<ValueParser.ValueAstNode>()

  ValueParser.walk(ast, (node, { parent }) => {
    const parentArray = parent === null ? ast : (parent.nodes ?? [])

    // Handle operators (e.g.: inside of `calc(…)`)
    if (
      node.kind === 'word'
      // Operators
      && (node.value === '+' || node.value === '-' || node.value === '*' || node.value === '/')
    ) {
      const idx = parentArray.indexOf(node) ?? -1

      // This should not be possible
      if (idx === -1) { return }

      const previous = parentArray[idx - 1]
      if (previous?.kind !== 'separator' || previous.value !== ' ') { return }

      const next = parentArray[idx + 1]
      if (next?.kind !== 'separator' || next.value !== ' ') { return }

      drop.add(previous)
      drop.add(next)
    }

    // The value parser handles `/` as a separator in some scenarios. E.g.:
    // `theme(colors.red/50%)`. Because of this, we have to handle this case
    // separately.
    else if (node.kind === 'separator' && node.value.trim() === '/') {
      node.value = '/'
    }

    // Leading and trailing whitespace
    else if (node.kind === 'separator' && node.value.length > 0 && node.value.trim() === '') {
      if (parentArray[0] === node || parentArray[parentArray.length - 1] === node) {
        drop.add(node)
      }
    }

    // Whitespace around `,` separators can be removed.
    // E.g.: `min(1px , 2px)` -> `min(1px,2px)`
    else if (node.kind === 'separator' && node.value.trim() === ',') {
      node.value = ','
    }
  })

  if (drop.size > 0) {
    ValueParser.walk(ast, (node, { replaceWith }) => {
      if (drop.has(node)) {
        drop.delete(node)
        replaceWith([])
      }
    })
  }

  recursivelyEscapeUnderscores(ast)

  return ValueParser.toCss(ast)
}

function simplifyArbitraryVariant(input: string) {
  const ast = ValueParser.parse(input)

  // &:is(…)
  if (
    ast.length === 3
    // &
    && ast[0].kind === 'word'
    && ast[0].value === '&'
    // :
    && ast[1].kind === 'separator'
    && ast[1].value === ':'
    // is(…)
    && ast[2].kind === 'function'
    && ast[2].value === 'is'
  ) {
    return ValueParser.toCss(ast[2].nodes)
  }

  return input
}

function recursivelyEscapeUnderscores(ast: ValueParser.ValueAstNode[]) {
  for (const node of ast) {
    switch (node.kind) {
      case 'function': {
        if (node.value === 'url' || node.value.endsWith('_url')) {
          // Don't decode underscores in url() but do decode the function name
          node.value = escapeUnderscore(node.value)
          break
        }

        if (
          node.value === 'var'
          || node.value.endsWith('_var')
          || node.value === 'theme'
          || node.value.endsWith('_theme')
        ) {
          // Don't decode underscores in the first argument of var() and theme()
          // but do decode the function name
          node.value = escapeUnderscore(node.value)
          for (let i = 0; i < node.nodes.length; i++) {
            if (i == 0 && node.nodes[i].kind === 'word') {
              continue
            }
            recursivelyEscapeUnderscores([node.nodes[i]])
          }
          break
        }

        node.value = escapeUnderscore(node.value)
        recursivelyEscapeUnderscores(node.nodes)
        break
      }
      case 'separator':
        node.value = escapeUnderscore(node.value)
        break
      case 'word': {
        // Dashed idents and variables `var(--my-var)` and `--my-var` should not
        // have underscores escaped
        if (node.value[0] !== '-' && node.value[1] !== '-') {
          node.value = escapeUnderscore(node.value)
        }
        break
      }
      default:
        never(node)
    }
  }
}

function isVar(value: string) {
  const ast = ValueParser.parse(value)
  return ast.length === 1 && ast[0].kind === 'function' && ast[0].value === 'var'
}

function never(value: never): never {
  throw new Error(`Unexpected value: ${value}`)
}

function escapeUnderscore(value: string): string {
  return value
    .replaceAll('_', String.raw`\_`) // Escape underscores to keep them as-is
    .replaceAll(' ', '_') // Replace spaces with underscores
}
