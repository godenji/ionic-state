import { Observable, of } from 'rxjs'
import { NgrxAction } from './action'

interface JsonError {
  msg: string
}

/**
 * @deprecated. Define own handler in client code
 */
export abstract class ResponseHandler {
  constructor(private error: (x: Error) => NgrxAction<Error>) {}

  errorHandler: (x: any) => Observable<NgrxAction<Error>> = x => {
    return of(this.error(new Error(this.parseError(x.error))))
  }

  private parseError(e: any) {
    let msg: string = ''
    switch (typeof e) {
      case 'string': msg = e; break
      case 'object':
        Object.keys(e).forEach(k => {
          const entry = e[k]
          if (entry instanceof Array) {
            entry.map(x => x as JsonError).forEach(
              x => {
                const sep = msg === '' ? '' : '; '
                return (msg += `${sep}${k.replace('obj.', '')}: ${x.msg}`)
              }
            )
          } else msg = entry.toString()
        })
    }
    return msg === '' ? null : msg
  }
}
