import { Injectable } from '@angular/core'
import { Platform } from '@ionic/angular'
import { Network } from '@capacitor/network'

@Injectable({ providedIn: 'root' })
export class NetworkService {
  isNative: boolean

  private _connected: boolean

  constructor(private platform: Platform) {
    this.isNative = this.platform.is('hybrid')

    this.initConnection()
    this.addConnectionListener()
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
}
