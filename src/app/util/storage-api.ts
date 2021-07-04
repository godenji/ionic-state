import { HttpClient } from '@angular/common/http'
import { Storage } from '@ionic/storage-angular'

export class StorageApi {
  token: string

  constructor(
    public remote: HttpClient,
    public local: Storage,
    readonly environment: { url: string }
  ) {
    this.getToken()
  }

  async getToken() {
    const x = await this.local.get('auth')
    const payload = x ? JSON.parse(x) : null
    if (payload) this.token = payload.token
    return this.token
  }
}
