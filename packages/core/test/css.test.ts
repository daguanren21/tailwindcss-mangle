import { getTestCase } from './utils'
import { cssHandler } from '@/css'
import { Context } from '@/ctx'

describe('css', () => {
  let ctx: Context
  beforeEach(() => {
    // classGenerator = new ClassGenerator()
    ctx = new Context()
  })

  it('preserveClassNamesSet case 0', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `.gap-y-4 {color:red;}`
    ctx.addPreserveClass('gap-y-4')
    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })

  it('preserveClassNamesSet case 1', async () => {
    await ctx.initConfig({
      classList: ['gap-y-4'],
    })
    const testCase = `.gap-y-4 {color:red;}`
    ctx.addPreserveClass('gap-y-4')
    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4 {
      }
    }`

    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped no ignore .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { css } = await cssHandler(testCase, {
      ctx,
      ignoreVueScoped: false,
    })
    expect(css).toMatchSnapshot()
  })

  it('common with scoped', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-white', 'tw-a')
    ctx.classGenerator.generateClassName('bg-white')
    const testCase = `
    .bg-white[data-v-0f84999b] {
      --tw-bg-opacity: 1;
      background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
    }`

    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })

  it('vue.scoped.css', async () => {
    const list = JSON.parse(getTestCase('nuxt-app-partial-class-set.json'))
    const replaceMap: Map<string, any> = ctx.replaceMap
    for (const cls of list) {
      replaceMap.set(cls, ctx.classGenerator.generateClassName(cls).name)
    }
    const testCase = getTestCase('vue.scoped.css')
    const { css } = await cssHandler(testCase, {
      ctx,
    })
    expect(css).toMatchSnapshot()
  })
})
