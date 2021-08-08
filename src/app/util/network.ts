import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Platform } from '@ionic/angular'
import { Network } from '@ionic-native/network/ngx'

@Injectable({ providedIn: 'root' })
export class NetworkService {
  isNative: boolean
  isOfflineMode: boolean = false
  isOfflineMode$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false)

  constructor(private platform: Platform, public device: Network) {
    this.isNative = this.platform.is('hybrid')
    this.isOfflineMode$.subscribe(x => (this.isOfflineMode = x))
  }

  isOnline(): boolean {
    if (this.isNative && this.device.type) {
      return this.device.type !== 'none'
    } else return navigator.onLine
  }

  isOffline(): boolean {
    if (this.isNative && this.device.type) {
      return this.device.type === 'none'
    } else return !navigator.onLine
  }

  /**
   * opt-in/out to offline mode
   */
  setOffline(isOffline: boolean) {
    this.isOfflineMode$.next(isOffline)
  }
}
