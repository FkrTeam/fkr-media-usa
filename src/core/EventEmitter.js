/** Minimal synchronous event bus used by the core systems. */
export default class EventEmitter {
  constructor() {
    this._handlers = new Map()
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event).add(handler)
    return () => this.off(event, handler)
  }

  once(event, handler) {
    const off = this.on(event, (...args) => {
      off()
      handler(...args)
    })
    return off
  }

  off(event, handler) {
    this._handlers.get(event)?.delete(handler)
  }

  emit(event, ...args) {
    const set = this._handlers.get(event)
    if (!set) return
    for (const handler of Array.from(set)) handler(...args)
  }

  destroy() {
    this._handlers.clear()
  }
}
