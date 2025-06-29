import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { EntityReducer, EntitySelector } from './reducer';
import { EntityState, defaultState } from './state';
import { Entity } from '../model/entity';
import { PaginatedResult } from '../util/paginated-result';

interface TestEntity extends Entity {
  name: string;
}

interface TestState extends EntityState<TestEntity, string> {}

describe('EntityReducer', () => {
  let adapter: EntityAdapter<TestEntity>;
  let reducer: EntityReducer<TestEntity, string, TestState>;
  let state: TestState;

  beforeEach(() => {
    adapter = createEntityAdapter<TestEntity>();
    state = adapter.getInitialState(defaultState);
    reducer = new EntityReducer(adapter, state, (e: TestEntity) => e);
  });

  it('should handle loading state', () => {
    const newState = reducer.loading();
    expect(newState.isLoading).toBe(true);
  });

  it('should handle loaded state with paginated data', () => {
    const payload: PaginatedResult<TestEntity> = {
      payload: [{ id: '1', name: 'Test' }],
      totalRecords: 1,
      currentPage: 1,
    };
    const newState = reducer.loaded(payload);
    expect(newState.isLoaded).toBe(true);
    expect(newState.totalRecords).toBe(1);
    expect(newState.currentPage).toBe(1);
    expect(newState.entities['1']).toEqual({ id: '1', name: 'Test' });
  });

  it('should handle loadedOne state', () => {
    const payload: TestEntity = { id: '1', name: 'Test' };
    const newState = reducer.loadedOne(payload);
    expect(newState.isLoaded).toBe(true);
    expect(newState.selected).toEqual(payload);
    expect(newState.selectedId).toBe('1');
  });

  it('should handle adding state', () => {
    const newState = reducer.add();
    expect(newState.isAdding).toBe(true);
  });

  it('should handle added state', () => {
    const payload: TestEntity = { id: '1', name: 'Test' };
    const newState = reducer.added(payload);
    expect(newState.isAdded).toBe(true);
    expect(newState.totalRecords).toBe(1);
    expect(newState.entities['1']).toEqual(payload);
  });

  it('should handle updating state', () => {
    const newState = reducer.update();
    expect(newState.isUpdating).toBe(true);
  });

  it('should handle updated state', () => {
    const entity: TestEntity = { id: '1', name: 'Initial' };
    state = reducer.added(entity);
    reducer = new EntityReducer(adapter, state, (e: TestEntity) => e);

    const updatedEntity: TestEntity = { id: '1', name: 'Updated' };
    const newState = reducer.updated(updatedEntity);
    expect(newState.isUpdated).toBe(true);
    expect(newState.entities['1']).toEqual(updatedEntity);
  });

  it('should handle deleting state', () => {
    const newState = reducer.delete();
    expect(newState.isDeleting).toBe(true);
  });

  it('should handle deleted state', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    state = reducer.added(entity);
    reducer = new EntityReducer(adapter, state, (e: TestEntity) => e);

    const newState = reducer.deleted(entity);
    expect(newState.isDeleted).toBe(true);
    expect(newState.totalRecords).toBe(0);
    expect(newState.entities['1']).toBeUndefined();
  });

  it('should handle failed state', () => {
    const error = new Error('Test Error');
    const newState = reducer.failed(error);
    expect(newState.error).toBe('Test Error');
  });

  it('should handle selected state', () => {
    const entity: TestEntity = { id: '1', name: 'Test' };
    const newState = reducer.selected(entity);
    expect(newState.selected).toEqual(entity);
    expect(newState.selectedId).toBe('1');
  });
});

describe('EntitySelector', () => {
  let adapter: EntityAdapter<TestEntity>;
  let selector: EntitySelector<TestEntity>;

  beforeEach(() => {
    adapter = createEntityAdapter<TestEntity>();
    selector = new EntitySelector(adapter);
  });

  it('should return the correct selectors', () => {
    const selectors = selector.selectors();
    expect(selectors.selectIds).toBeDefined();
    expect(selectors.selectEntities).toBeDefined();
    expect(selectors.selectAll).toBeDefined();
    expect(selectors.selectTotal).toBeDefined();
  });
});
