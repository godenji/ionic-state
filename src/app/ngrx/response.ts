import { Observable, of } from 'rxjs'
import { NgrxAction } from './action'

interface JsonError {
  path: string
  errors: [string]
}

export abstract class ResponseHandler {
  constructor(private error: (x: Error) => NgrxAction<Error>) {}

  errorHandler: (x: any) => Observable<NgrxAction<Error>> = x => {
    return of(this.error(new Error(this.parseError(x.error))))
  }

  private parseError(e: any) {
    let msg: string = ''
    if (e) {
      if (typeof e === 'string') msg = e
      else if (e instanceof Array) {
        e.map(x => x as JsonError).forEach(
          x => (msg += `${x.path}: ${x.errors[0]}`)
        )
      } else msg = e.toString()
    }
    return msg === '' ? null : msg
  }
}
