import { NgrxAction, EntityActions } from './action';
import { Entity } from '../model/entity';
import { Id } from '../model/key/id';
import { QueryParams } from '../util/query-params';

// Mock Data and Classes
interface MockEntity extends Entity {
  id: string;
  name: string;
}

const MOCK_ENTITY_1: MockEntity = { id: '1', name: 'Entity 1' };
const MOCK_ENTITY_2: MockEntity = { id: '2', name: 'Entity 2' };

class ConcreteEntityActions implements EntityActions<MockEntity, string> {
  constructor(private typePrefix: string) {}

  loading(q?: QueryParams): NgrxAction {
    return { type: `[${this.typePrefix}] Loading`, payload: q };
  }
  loadingOne(id: string): NgrxAction {
    return { type: `[${this.typePrefix}] Loading One`, payload: id };
  }
  select(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.typePrefix}] Select`, payload: t };
  }
  create(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.typePrefix}] Create`, payload: t };
  }
  createMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.typePrefix}] Create Many`, payload: t };
  }
  update(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.typePrefix}] Update`, payload: t };
  }
  updateMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.typePrefix}] Update Many`, payload: t };
  }
  delete(t: MockEntity): NgrxAction<MockEntity> {
    return { type: `[${this.typePrefix}] Delete`, payload: t };
  }
  deleteMany(t: MockEntity[]): NgrxAction<MockEntity[]> {
    return { type: `[${this.typePrefix}] Delete Many`, payload: t };
  }
}

describe('NgrxAction', () => {
  it('should create an action with a payload', () => {
    class TestAction extends NgrxAction<string> {
      readonly type = '[Test] Action';
    }
    const action = new TestAction('test payload');
    expect(action.type).toBe('[Test] Action');
    expect(action.payload).toBe('test payload');
  });

  it('should create an action without a payload', () => {
    class TestAction extends NgrxAction {
      readonly type = '[Test] No Payload Action';
    }
    const action = new TestAction();
    expect(action.type).toBe('[Test] No Payload Action');
    expect(action.payload).toBeUndefined();
  });
});

describe('EntityActions', () => {
  const typePrefix = 'User';
  let actions: ConcreteEntityActions;

  beforeEach(() => {
    actions = new ConcreteEntityActions(typePrefix);
  });

  it('should create a loading action', () => {
    const queryParams: QueryParams = { page: 1, size: 10 };
    const action = actions.loading(queryParams);
    expect(action.type).toBe(`[${typePrefix}] Loading`);
    expect(action.payload).toEqual(queryParams);
  });

  it('should create a loadingOne action', () => {
    const id = 'someId';
    const action = actions.loadingOne(id);
    expect(action.type).toBe(`[${typePrefix}] Loading One`);
    expect(action.payload).toBe(id);
  });

  it('should create a select action', () => {
    const action = actions.select(MOCK_ENTITY_1);
    expect(action.type).toBe(`[${typePrefix}] Select`);
    expect(action.payload).toEqual(MOCK_ENTITY_1);
  });

  it('should create a create action', () => {
    const action = actions.create(MOCK_ENTITY_1);
    expect(action.type).toBe(`[${typePrefix}] Create`);
    expect(action.payload).toEqual(MOCK_ENTITY_1);
  });

  it('should create a createMany action', () => {
    const action = actions.createMany([MOCK_ENTITY_1, MOCK_ENTITY_2]);
    expect(action.type).toBe(`[${typePrefix}] Create Many`);
    expect(action.payload).toEqual([MOCK_ENTITY_1, MOCK_ENTITY_2]);
  });

  it('should create an update action', () => {
    const action = actions.update(MOCK_ENTITY_1);
    expect(action.type).toBe(`[${typePrefix}] Update`);
    expect(action.payload).toEqual(MOCK_ENTITY_1);
  });

  it('should create an updateMany action', () => {
    const action = actions.updateMany([MOCK_ENTITY_1, MOCK_ENTITY_2]);
    expect(action.type).toBe(`[${typePrefix}] Update Many`);
    expect(action.payload).toEqual([MOCK_ENTITY_1, MOCK_ENTITY_2]);
  });

  it('should create a delete action', () => {
    const action = actions.delete(MOCK_ENTITY_1);
    expect(action.type).toBe(`[${typePrefix}] Delete`);
    expect(action.payload).toEqual(MOCK_ENTITY_1);
  });

  it('should create a deleteMany action', () => {
    const action = actions.deleteMany([MOCK_ENTITY_1, MOCK_ENTITY_2]);
    expect(action.type).toBe(`[${typePrefix}] Delete Many`);
    expect(action.payload).toEqual([MOCK_ENTITY_1, MOCK_ENTITY_2]);
  });
});
