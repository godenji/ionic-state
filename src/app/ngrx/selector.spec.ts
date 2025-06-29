import { createFeatureSelector, createSelector } from '@ngrx/store';
import { Dictionary } from '@ngrx/entity';
import { Entity } from '../model/entity';
import { Id } from '../model/key/id';
import { EntityState } from './state';
import { PaginatedResult } from '../util/paginated-result';
import { Selector, Selectors } from './selector';

// Mock Data and Classes
interface MockEntity extends Entity {
  id: string;
  name: string;
}

const MOCK_ENTITY_1: MockEntity = { id: '1', name: 'Entity 1' };
const MOCK_ENTITY_2: MockEntity = { id: '2', name: 'Entity 2' };

interface MockEntityState extends EntityState<MockEntity, string> {
  ids: string[];
  entities: Dictionary<MockEntity>;
  isLoading: boolean;
  isLoaded: boolean;
  isAdding: boolean;
  isAdded: boolean;
  isUpdating: boolean;
  isUpdated: boolean;
  isDeleting: boolean;
  isDeleted: boolean;
  selectedId: string;
  selected: MockEntity;
  error: any;
  totalRecords: number;
  currentPage: number;
}

const mockState: MockEntityState = {
  ids: ['1', '2'],
  entities: {
    '1': MOCK_ENTITY_1,
    '2': MOCK_ENTITY_2,
  },
  isLoading: false,
  isLoaded: true,
  isAdding: false,
  isAdded: false,
  isUpdating: false,
  isUpdated: false,
  isDeleting: false,
  isDeleted: false,
  selectedId: '1',
  selected: MOCK_ENTITY_1,
  error: null,
  totalRecords: 2,
  currentPage: 1,
};

// Mock @ngrx/store functions
jest.mock('@ngrx/store', () => ({
  createFeatureSelector: jest.fn((featureName: string) => (state: any) => state[featureName]),
  createSelector: jest.fn((...args: any[]) => {
    const projector = args[args.length - 1];
    const selectors = args.slice(0, args.length - 1);
    return (state: any) => {
      const selectedValues = selectors.map((selector: any) => selector(state));
      return projector(...selectedValues);
    };
  }),
}));

describe('Selector', () => {
  const featureKey = 'mockFeature';
  let selector: Selector<MockEntity, string, MockEntityState>;
  let mockSelectors: Selectors<MockEntity, string, MockEntityState>;

  beforeEach(() => {
    mockSelectors = {
      selectIds: (state) => state.ids,
      selectEntities: (state) => state.entities,
      selectAll: (state) => Object.values(state.entities),
      selectTotal: (state) => state.ids.length,
    };
    selector = new Selector(featureKey, mockSelectors);
  });

  it('should be created', () => {
    expect(selector).toBeTruthy();
  });

  it('should select all entities', () => {
    const result = selector.all({ mockFeature: mockState });
    expect(result).toEqual([MOCK_ENTITY_1, MOCK_ENTITY_2]);
  });

  it('should select entities map', () => {
    const result = selector.map({ mockFeature: mockState });
    expect(result).toEqual(mockState.entities);
  });

  it('should select ids', () => {
    const result = selector.ids({ mockFeature: mockState });
    expect(result).toEqual(mockState.ids);
  });

  it('should select total', () => {
    const result = selector.total({ mockFeature: mockState });
    expect(result).toEqual(mockState.ids.length);
  });

  it('should select by id', () => {
    const selectById = selector.byId({ mockFeature: mockState });
    const result = selectById('1');
    expect(result).toEqual(MOCK_ENTITY_1);
  });

  it('should select paginated result', () => {
    const result = selector.paginated({ mockFeature: mockState });
    expect(result).toEqual({
      payload: [MOCK_ENTITY_1, MOCK_ENTITY_2],
      totalRecords: mockState.totalRecords,
      currentPage: mockState.currentPage,
    });
  });

  it('should transform all entities with allWithEntities', () => {
    const transformedEntities = selector.allWithEntities(
      [MOCK_ENTITY_1, MOCK_ENTITY_2],
      (entity) => ({ ...entity, name: entity.name.toUpperCase() })
    );
    expect(transformedEntities).toEqual([
      { id: '1', name: 'ENTITY 1' },
      { id: '2', name: 'ENTITY 2' },
    ]);
  });

  it('should transform paginated entities with paginatedWithEntities', () => {
    const paginatedResult: PaginatedResult<MockEntity> = {
      payload: [MOCK_ENTITY_1],
      totalRecords: 1,
      currentPage: 1,
    };
    const transformedPaginatedResult = selector.paginatedWithEntities(
      paginatedResult,
      (entity) => ({ ...entity, name: entity.name + ' Transformed' })
    );
    expect(transformedPaginatedResult).toEqual({
      payload: [{ id: '1', name: 'Entity 1 Transformed' }],
      totalRecords: 1,
      currentPage: 1,
    });
  });
});
