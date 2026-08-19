export function isNearScrollEnd(element: HTMLElement, threshold = 48) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight < threshold
  )
}
