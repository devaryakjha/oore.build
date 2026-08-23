import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'

import {
  BreadcrumbTrail,
  resolveBreadcrumbLabel,
  type BreadcrumbTrailItem,
} from './page-breadcrumb'

function renderTrail(items: Array<BreadcrumbTrailItem>) {
  const rootRoute = createRootRoute({
    component: () => <BreadcrumbTrail items={items} />,
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute,
  })

  return router
    .load()
    .then(() => renderToStaticMarkup(<RouterProvider router={router} />))
}

describe('BreadcrumbTrail', () => {
  test('renders linked ancestors and one plain-text current page', async () => {
    const html = await renderTrail([
      { href: '/projects', label: 'Projects' },
      { href: '/projects/project-1', label: 'Mobile app' },
    ])

    expect(html).toContain('<a')
    expect(html).toContain('href="/projects"')
    expect(html).toContain('>Projects</a>')
    expect(html).toContain(
      '</li><li data-slot="breadcrumb-separator" role="presentation"',
    )
    expect(html).toContain('aria-current="page"')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).not.toContain('role="link"')
    expect(html).not.toContain('aria-disabled="true"')
    expect(html).not.toContain('href="/projects/project-1"')
  })

  test('keeps the full accessible text when a visible label is truncated', async () => {
    const label = 'A very long project name that must remain available'
    const html = await renderTrail([{ href: '/projects/project-1', label }])

    expect(html).toContain(`title="${label}"`)
    expect(html).toContain(`>${label}</span>`)
  })
})

describe('resolveBreadcrumbLabel', () => {
  test('uses loaded entity labels', () => {
    expect(
      resolveBreadcrumbLabel(
        { entity: 'project', href: '/projects/project-1', label: 'Project' },
        { projectName: 'Mobile app' },
      ),
    ).toBe('Mobile app')
    expect(
      resolveBreadcrumbLabel(
        {
          entity: 'pipeline',
          href: '/projects/project-1/pipelines/pipeline-1',
          label: 'Pipeline',
        },
        { pipelineName: 'Release' },
      ),
    ).toBe('Release')
    expect(
      resolveBreadcrumbLabel(
        { entity: 'build', href: '/builds/build-1', label: 'Build' },
        { buildNumber: 42 },
      ),
    ).toBe('Build #42')
  })

  test('keeps stable fallbacks for missing and blank data', () => {
    expect(
      resolveBreadcrumbLabel(
        { entity: 'project', href: '/projects/project-1', label: 'Project' },
        { projectName: '   ' },
      ),
    ).toBe('Project')
    expect(
      resolveBreadcrumbLabel(
        { entity: 'build', href: '/builds/build-1', label: 'Build' },
        {},
      ),
    ).toBe('Build')
  })
})
