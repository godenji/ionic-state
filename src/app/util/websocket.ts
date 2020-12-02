import { Injectable } from '@angular/core'
import { of } from 'rxjs'
import { catchError, filter, map, tap } from 'rxjs/operators'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket'
import { Store } from '@ngrx/store'
import { Session } from '../model/session'
import { User } from '../model/user'

export interface Payload {
  type: string
  payload: any
}

type ActionType =
  | 'ADDED'
  | 'ADDED_MANY'
  | 'UPDATED'
  | 'UPDATED_MANY'
  | 'DELETED'
  | 'DELETED_MANY'

@Injectable({ providedIn: 'root' })
export abstract class Websocket {
  private ws: WebSocketSubject<Payload>

  // params for reconnecting websocket
  private retryMax = 36
  private retryCount = 0
  private retryInterval = 5000

  abstract load<U extends User>(user: U): void
  abstract getAction(response: Payload): any

  constructor(
    protected store: Store<any>,
    private environment: { wss: string }
  ) {}

  connect(session: Session) {
    if (!this.isConnected()) {
      this.connectToSocket(session)
    }
  }

  disconnect() {
    if (this.isConnected()) {
      this.ws.unsubscribe()
      this.ws = null
    }
  }

  private isConnected() {
    return this.ws && !this.ws.closed
  }

  private connectToSocket(session: Session) {
    if (!this.ws) {
      this.createSocket(session)
      this.subscribeToSocket(session)
    }
  }

  private createSocket(x: Session) {
    const url = `${this.environment.wss}/socket/${x.id}`
    this.ws = webSocket(url)
  }

  private subscribeToSocket(session: Session) {
    const keepalive = setInterval(() => this.ping(), 30000)
    const retry = (msg: string, err?: string) => {
      console.error(`WEBSOCKET ${msg}!`, err || '')
      clearInterval(keepalive)
      this.disconnect()
      this.retry(session)
    }
    this.ws
      .pipe(
        tap(_ => {
          // socket reconnected
          if (this.retryCount !== 0) {
            console.log('WEBSOCKET CONNECTED')
            this.load(session.user) // sync backend changes since last connect
          }
          this.retryCount = 0
        }),
        catchError(_ => of<Payload>({ type: 'ERROR', payload: {} })),
        filter(x => this.actionRegex.test(x.type)),
        map(x => this.getAction(x))
      )
      .subscribe(
        x => this.store.dispatch(x),
        err => retry('ERROR', err),
        () => retry('CLOSED')
      )
  }

  private retry = (session: Session) => {
    this.retryCount++
    console.log(`Trying to reconnect: ${this.retryCount}`)
    if (this.retryMax > this.retryCount)
      setTimeout(() => this.connectToSocket(session), this.retryInterval)
    else
      console.error(`RECONNECT FAILED! Gave up after ${this.retryMax} attempts`)
  }

  private ping() {
    this.ws ? this.ws.next({ type: 'PING', payload: {} }) : null
  }

  private actionRegex = /(ADDED|UPDATED|DELETED)_(.*)/

  protected getActionType(_type: string): ActionType {
    let action: ActionType
    if (_type.startsWith('ADDED_MANY')) action = 'ADDED_MANY'
    else if (_type.startsWith('ADDED')) action = 'ADDED'
    else if (_type.startsWith('UPDATED_MANY')) action = 'UPDATED_MANY'
    else if (_type.startsWith('UPDATED')) action = 'UPDATED'
    else if (_type.startsWith('DELETED_MANY')) action = 'DELETED_MANY'
    else action = 'DELETED'

    return action
  }
}
