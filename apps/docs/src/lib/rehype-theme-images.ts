type HastNode = {
  children?: HastNode[]
  properties?: Record<string, unknown>
  tagName?: string
  type: string
}

function darkImagePath(path: string) {
  return path.replace(/(\.[^./]+)$/, '-dark$1')
}

function imageVariant(
  node: HastNode,
  source: string,
  className: string,
): HastNode {
  const classes = Array.isArray(node.properties?.className)
    ? node.properties.className
    : []

  return {
    ...node,
    properties: {
      ...node.properties,
      className: [...classes, className],
      decoding: 'async',
      height: 900,
      loading: 'lazy',
      src: source,
      width: 1440,
    },
  }
}

export function rehypeThemeImages() {
  return (tree: HastNode) => {
    function transform(node: HastNode) {
      if (!node.children) return

      node.children = node.children.map((child) => {
        const source = child.properties?.src
        if (
          child.type === 'element' &&
          child.tagName === 'img' &&
          typeof source === 'string' &&
          source.startsWith('/')
        ) {
          return {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['oore-theme-image'],
            },
            children: [
              imageVariant(child, source, 'oore-theme-image-light'),
              imageVariant(
                child,
                darkImagePath(source),
                'oore-theme-image-dark',
              ),
            ],
          }
        }

        transform(child)
        return child
      })
    }

    transform(tree)
  }
}
