import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Platform } from '@ionic/angular'
import { Network } from '@capacitor/network'

@Injectable({ providedIn: 'root' })
export class NetworkService {
  isNative: boolean

  connected = true
  connected$: BehaviorSubject<boolean> = new BehaviorSubject(true)

  isOfflineMode = false
  isOfflineMode$: BehaviorSubject<boolean> = new BehaviorSubject(false)

  constructor(private platform: Platform) {
    this.isNative = this.platform.is('hybrid')

    Network.addListener('networkStatusChange', x => {
      console.log('network status changed:', x)
      this.connected$.next(x.connected)
    })
    this.connected$.subscribe(x => (this.connected = x))
    this.isOfflineMode$.subscribe(x => (this.isOfflineMode = x))
  }

  /**
   * opt-in/out to offline mode
   */
  setOffline(isOffline: boolean) {
    this.isOfflineMode$.next(isOffline)
  }
}
