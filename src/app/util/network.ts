import { Injectable } from '@angular/core'
import { Platform } from '@ionic/angular'
import { Network } from '@capacitor/network'
import { BehaviorSubject, Observable, pipe, map } from 'rxjs'

type OfflineProps = { enabled: boolean, withQueue: boolean }

@Injectable({ providedIn: 'root' })
export class NetworkService {
  isNative: boolean

  private _offline = { enabled: false, withQueue: true }
  private _connected = false
  private _connected$ = new BehaviorSubject<boolean>(null)

  get offline(): OfflineProps {
    return this._offline
  }

  set offline(x: OfflineProps) {
    this._offline = x
  }

  private set connected(x: boolean) {
    this._connected = x
    this._connected$.next(x)
  }

  get connected(): boolean {
    return this._connected && !this.offline.enabled
  }

  get connected$(): Observable<boolean> {
    return this._connected$.asObservable().pipe(
      map(x => x && !this.offline.enabled)
    )
  }

  constructor(private platform: Platform) {
    this.isNative = this.platform.is('hybrid')
    this.initConnection()
    this.addConnectionListener()
  }

  private initConnection() {
    Network.getStatus().then(x => this.connected = x.connected)
  }

  private addConnectionListener() {
    Network.addListener('networkStatusChange', x => {
      console.log('network status changed:', x)
      this.connected = x.connected
    })
  }
}
