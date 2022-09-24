import { Injectable } from '@angular/core'
import { Observable, BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class TokenService {
  token$: BehaviorSubject<string> = new BehaviorSubject(null)

  setToken(token: string) {
    this.token$.next(token)
  }
}
