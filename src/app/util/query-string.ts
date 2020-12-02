import { QueryParams } from './query-params'

export class QueryString {
  private eq = '='
  private sep = '&'

  build(q?: QueryParams): string {
    if (!q) return ''
    return Object.keys(q)
      .map(k => {
        const ks = this.encode(k) + this.eq
        return Array.isArray(q[k])
          ? q[k].map(v => ks + this.encode(v)).join(this.sep)
          : ks + this.encode(q[k])
      })
      .join(this.sep)
  }

  private encode(v: any): string {
    return encodeURIComponent(this.stringify(v))
  }

  private stringify(v: any): string {
    switch (typeof v) {
      case 'string':
        return v
      case 'boolean':
        return v ? 'true' : 'false'
      case 'number':
        return isFinite(v) ? v.toString() : ''
      default:
        return ''
    }
  }
}
