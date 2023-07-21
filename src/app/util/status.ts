import { Observable, BehaviorSubject, take } from 'rxjs'

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
    loading.pipe(take(1)).subscribe(bools => {
      const loaded = bools?.every(x => Boolean(x))
      this.setLoading(loaded)
    })
  }
}
