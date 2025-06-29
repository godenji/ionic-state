import { Action, Store } from '@ngrx/store';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Entity } from '../model/entity';
import { Id } from '../model/key/id';
import { EntityActions, NgrxAction } from './action';
import { EntityState } from './state';
import { EntityStore } from './store';
import { QueryParams } from '../util/query-params';

// Mock Data and Classes
interface MockEntity extends Entity {
  id: string;
  name: string;
}

const MOCK_ENTITY_1: MockEntity = { id: '1', name: 'Entity 1' };
const MOCK_ENTITY_2: MockEntity = { id: '2', name: 'Entity 2' };

class MockEntityActions implements EntityActions<MockEntity, string> {
  constructor(private type: string) {}
  loading(q?: QueryParams): NgrxAction<QueryParams> {
    return { type: `[${this.type}] loading`, payload: q };
  }
  loadingOne(id: string): NgrxAction<string> {
    return { type: `[${this.type}] loadingOne`, payload: id };
  }
  select(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.type}] select`, payload: t };
  }
  create(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.type}] create`, payload: t };
  }
  createMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.type}] createMany`, payload: t };
  }
  update(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.type}] update`, payload: t };
  }
  updateMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.type}] updateMany`, payload: t };
  }
  delete(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.type}] delete`, payload: t };
  }
  deleteMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.type}] deleteMany`, payload: t };
  }
}

// Concrete implementation of EntityStore
class MockEntityStore extends EntityStore<MockEntity, string> {
  protected store: Store<any>;

  constructor(
    store: Store<any>,
    entity: EntityActions<MockEntity, string>,
    store$: Observable<EntityState<MockEntity, string>>,
    selectAll: (state: EntityState<MockEntity, string>) => MockEntity[]
  ) {
    super(entity, store$, selectAll);
    this.store = store;
  }
}

describe('EntityStore', () => {
  let store: MockEntityStore;
  let mockNgRxStore: Partial<Store<any>>;
  let entityActions: MockEntityActions;
  let state$: BehaviorSubject<EntityState<MockEntity, string>>;
  let selectAll: (state: EntityState<MockEntity, string>) => MockEntity[];

  const initialState: EntityState<MockEntity, string> = {
    ids: [],
    entities: {},
    isLoading: false,
    isLoaded: false,
    isAdding: false,
    isAdded: false,
    isUpdating: false,
    isUpdated: false,
    isDeleting: false,
    isDeleted: false,
    selected: null,
    selectedId: null,
    totalRecords: 0,
    currentPage: 0,
    error: null,
  };

  beforeEach(() => {
    mockNgRxStore = {
      dispatch: jest.fn(),
    };
    entityActions = new MockEntityActions('Mock');
    selectAll = (s) => (s.ids as string[]).map((id) => s.entities[id]);
    state$ = new BehaviorSubject<EntityState<MockEntity, string>>(
      initialState
    );
    store = new MockEntityStore(
      mockNgRxStore as Store<any>,
      entityActions,
      state$.asObservable(),
      selectAll
    );
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  // Test observables
  it('should select loading state', (done) => {
    state$.next({ ...state$.value, isLoading: true });
    store.loading$.pipe(take(1)).subscribe((loading) => {
      expect(loading).toBe(true);
      done();
    });
  });

  it('should select entities', (done) => {
    state$.next({
      ...state$.value,
      ids: ['1'],
      entities: { '1': MOCK_ENTITY_1 },
    });
    store.entities$.pipe(take(1)).subscribe((entities) => {
      expect(entities).toEqual([MOCK_ENTITY_1]);
      done();
    });
  });

  it('should select paginated result', (done) => {
    state$.next({
      ...state$.value,
      ids: ['1'],
      entities: { '1': MOCK_ENTITY_1 },
      totalRecords: 1,
      currentPage: 1,
    });
    store.paginated$.pipe(take(1)).subscribe((paginated) => {
      expect(paginated.payload).toEqual([MOCK_ENTITY_1]);
      expect(paginated.totalRecords).toBe(1);
      expect(paginated.currentPage).toBe(1);
      done();
    });
  });

  it('should emit success on add', (done) => {
    store.onSuccess((result) => {
      expect(result).toEqual(MOCK_ENTITY_1);
      done();
    });
    state$.next({
      ...state$.value,
      isAdded: true,
      selected: MOCK_ENTITY_1,
    });
  });

  it('should emit error', (done) => {
    const error = new Error('test error');
    store.onError((err) => {
      expect(err).toEqual(error);
      done();
    });
    state$.next({ ...state$.value, error });
  });

  // Test methods
  it('should dispatch load action', () => {
    const action = entityActions.loading();
    store.load();
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch loadOne action', () => {
    const id = '1';
    const action = entityActions.loadingOne(id);
    store.loadOne(id);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch create action', () => {
    const action = entityActions.create(MOCK_ENTITY_1);
    store.create(MOCK_ENTITY_1);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch createMany action', () => {
    const entities = [MOCK_ENTITY_1, MOCK_ENTITY_2];
    const action = entityActions.createMany(entities);
    store.createMany(entities);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch update action', () => {
    const action = entityActions.update(MOCK_ENTITY_1);
    store.update(MOCK_ENTITY_1);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch updateMany action', () => {
    const entities = [MOCK_ENTITY_1, MOCK_ENTITY_2];
    const action = entityActions.updateMany(entities);
    store.updateMany(entities);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch delete action', () => {
    const action = entityActions.delete(MOCK_ENTITY_1);
    store.delete(MOCK_ENTITY_1);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should dispatch deleteMany action', () => {
    const entities = [MOCK_ENTITY_1, MOCK_ENTITY_2];
    const action = entityActions.deleteMany(entities);
    store.deleteMany(entities);
    expect(mockNgRxStore.dispatch).toHaveBeenCalledWith(action);
  });

  it('should find an entity by a condition', (done) => {
    state$.next({
      ...state$.value,
      ids: ['1', '2'],
      entities: { '1': MOCK_ENTITY_1, '2': MOCK_ENTITY_2 },
    });
    store.findBy((e) => e.name === 'Entity 2').subscribe((entity) => {
      expect(entity).toEqual(MOCK_ENTITY_2);
      done();
    });
  });

  it('should find all entities by a condition', (done) => {
    state$.next({
      ...state$.value,
      ids: ['1', '2'],
      entities: { '1': MOCK_ENTITY_1, '2': MOCK_ENTITY_2 },
    });
    store
      .findAllBy((e) => e.name.startsWith('Entity'))
      .subscribe((entities) => {
        expect(entities).toEqual([MOCK_ENTITY_1, MOCK_ENTITY_2]);
        done();
      });
  });

  it('should call onSuccess when onResult is called', () => {
    const successCb = jest.fn();
    const errorCb = jest.fn();
    store.onSuccess = jest.fn();
    store.onResult(successCb, errorCb);
    expect(store.onSuccess).toHaveBeenCalledWith(successCb);
  });

  it('should call onError when onResult is called with an error callback', () => {
    const successCb = jest.fn();
    const errorCb = jest.fn();
    store.onError = jest.fn();
    store.onResult(successCb, errorCb);
    expect(store.onError).toHaveBeenCalledWith(errorCb);
  });
});
