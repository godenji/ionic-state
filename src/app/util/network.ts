import { Injectable } from '@angular/core'
import { Platform } from '@ionic/angular'
import { Network } from '@capacitor/network'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class NetworkService {
  isNative: boolean

  private _connected = false
  private _isOfflineMode = false
  private offlineMode$ = new BehaviorSubject<boolean>(false)

  constructor(private platform: Platform) {
    this.isNative = this.platform.is('hybrid')

    this.initConnection()
    this.addConnectionListener()
    this.offlineMode$.subscribe(x => (this._isOfflineMode = x))
  }

  private initConnection() {
    Network.getStatus().then(x => (this._connected = x.connected))
  }

  private addConnectionListener() {
    Network.addListener('networkStatusChange', x => {
      console.log('network status changed:', x)
      this._connected = x.connected
    })
  }

  get connected(): boolean {
    return this._connected
  }

  get isOfflineMode(): boolean {
    return this._isOfflineMode
  }

  /**
   * opt-in/out of offline mode
   */
  setOffline(x: { isOffline: boolean }) {
    this.offlineMode$.next(x.isOffline)
  }
}
