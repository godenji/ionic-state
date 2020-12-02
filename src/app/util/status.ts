import { Observable, BehaviorSubject } from 'rxjs'

export class StatusService {
  loading$: BehaviorSubject<boolean> = new BehaviorSubject(false)

  setLoading(loading: boolean) {
    this.loading$.next(loading)
  }

  /**
   * emit loaded status based on whether or not batch of
   * observables have completed
   */
  setLoaded(loading: Observable<boolean[]>) {
    loading.subscribe(bools => {
      const loaded = bools.every(x => !x)
      this.setLoading(!loaded)
    })
  }
}
