import { Injectable } from '@angular/core'
import { Storage } from '@ionic/storage-angular'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class TokenService {
  private _token: string

  token$: BehaviorSubject<string> = new BehaviorSubject(null)

  constructor(private storage: Storage) {
    this.storage.create()
    this.get('auth')
    this.token$.subscribe(x => this._token = x)
  }

  private get(key: string): void {
    this.storage
      .get(key)
      .then(x =>
        this.token$.next(x ? JSON.parse(x)?.token : null)
      )
  }

  set(key: string, token: string): Promise<void> {
    return this.storage
      .set(key, JSON.stringify({ token }))
      .then(_ => this.token$.next(token))
  }

  /** current token value */
  get value(): string {
    return this._token
  }
}
