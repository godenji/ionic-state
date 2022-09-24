import { HttpClient } from '@angular/common/http'
import { Storage } from '@ionic/storage-angular'
import { TokenService } from './token'

export class StorageApi {
  token: string

  constructor(
    public remote: HttpClient,
    public local: Storage,
    public service: TokenService,
    readonly environment: { url: string }
  ) {
    this.service.token$.subscribe(x => this.token = x)
    this.getToken().then(x => x ? this.service.setToken(x) : null)
  }

  async getToken() {
    const x = await this.local.get('auth')
    return x ? JSON.parse(x)?.token : null
  }
}
