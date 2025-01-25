import { HttpClient } from '@angular/common/http'
import { Storage } from '@ionic/storage-angular'
import { TokenService } from './token'

export class StorageApi {
  constructor(
    public remote: HttpClient,
    public local: Storage,
    public token: TokenService,
    readonly environment: { url: string }
  ) {}
}
