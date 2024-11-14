import { Injectable, inject } from '@angular/core'
import { Storage } from '@ionic/storage-angular'
import { BehaviorSubject, Observable, from, take } from 'rxjs'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'

type Action = 'add' | 'update' | 'delete'
type EntityWithAction = { entity: Entity, action: Action }
type Queue = { [key: string]: EntityWithAction[] }

const storageKey = 'offline_queue'

@Injectable({ providedIn: 'root' })
/**
 * a singleton FIFO queue to track offline add/edit/delete operations
 */
export class OfflineQueue {
  private local: Storage
  private _queue: Queue = {}

  private set queue(x: Queue) {
    this._queue = x
  }

  get queue(): Queue {
    return this._queue
  }

  constructor() {
    this.local = inject(Storage)
    from(this.local.get(storageKey))
      .pipe(take(1))
      .subscribe(x => {
        if (x) {
          this.queue = JSON.parse(x) as Queue
        }
      })
  }

  /**
   * adds element(s) to queue paired with their `Action` type
   */
  add<T extends Entity>(t: T | T[], o: { key: string, action: Action }): void {
    const xs = this.queue[o.key] ?? []
    if (xs.length == 0) {
      const action = { action: o.action }
      if (Array.isArray(t)) t.forEach(entity => xs.push({ entity, ...action }))
      else xs.push({ entity: t, ...action })
    }
    else {
      const f = (entity: T) => {
        const e = { entity, action: o.action }

        // find latest version of entity (if exists) in the queue
        const idx = xs.findIndex(x => x.entity.id == entity.id)

        if (idx >= 0) xs[idx] = e // exists, replace with current state
        else xs.push(e) // no match, add new entity to queue
      }
      if (Array.isArray(t)) t.forEach(f)
      else f(t)
    }
    this.queue[o.key] = xs
    this.storeQueue(this.queue)
  }

  /**
   * removes element(s) from queue
   */
  remove<T extends Entity>(t: T | T[], key: string): void {
    const xs = this.queue[key] ?? []
    if (xs.length > 0) {
      let ids: Id[]
      if (!Array.isArray(t)) ids = [t.id]
      else ids = t.map(x => x.id)
      this.queue[key] = xs.filter(x => !(ids.includes(x.entity.id)))
      this.storeQueue(this.queue)
    }
  }

  /* remove all entries from queue */
  clear(): void {
    this.queue = {}
    this.storeQueue(this.queue)
  }

  private storeQueue(x: Queue) {
    this.local.set(storageKey, JSON.stringify(x))
  }
}
