import { Injectable } from '@angular/core'
import { Storage } from '@ionic/storage-angular'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class TokenService {
  private _token: string
  private isRefreshing = false

  token$: BehaviorSubject<string> = new BehaviorSubject(null)

  constructor(private storage: Storage) {
    this.storage.create()
    this.get('auth')
    this.token$.subscribe(x => this._token = x)
  }

  private _decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      return JSON.parse(jsonPayload)
    } catch (e) {
      console.error('Error decoding token:', e)
      return null
    }
  }

  isTokenExpired(token: string): boolean {
    if (!token) return true
    const decoded = this._decodeToken(token)
    if (!decoded || !decoded.exp) return true

    const expirationDate = new Date(0)
    expirationDate.setUTCSeconds(decoded.exp)
    return expirationDate.valueOf() < new Date().valueOf()
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

  // Placeholder for actual API call to refresh token
  private async refreshAccessToken(): Promise<string> {
    if (this.isRefreshing) {
      // Wait for the current refresh to complete
      return new Promise(resolve => {
        const sub = this.token$.subscribe(token => {
          if (!this.isRefreshing) {
            sub.unsubscribe()
            resolve(token)
          }
        })
      })
    }

    this.isRefreshing = true
    console.log('Refreshing token...')
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        const newToken = 'new.dummy.jwt.token' + Date.now()
        this.set('auth', newToken).then(() => {
          this.isRefreshing = false
          resolve(newToken)
        })
      }, 1000)
    })
  }

  /** current token value */
  get value(): string {
    if (this._token && this.isTokenExpired(this._token)) {
      this.refreshAccessToken().then(newToken => {
        // Token refreshed, update _token and token$
        this._token = newToken
        this.token$.next(newToken)
      }).catch(err => {
        console.error('Failed to refresh token:', err)
        // Handle refresh failure, e.g., log out user
        this.token$.next(null) // Invalidate token
      })
      // Return the old token for now, or null if you prefer to block until refresh
      return null // Or this._token if you want to use the expired token until refresh completes
    }
    return this._token
  }
}
