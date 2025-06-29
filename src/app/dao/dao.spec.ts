import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { Dao, KeyType } from './dao';
import { StorageApi } from '../util/storage-api';
import { NetworkService } from '../util/network';
import { OfflineQueue } from '../util/offline-queue';
import { Entity } from '../model/entity';

// Concrete implementation of the abstract Dao for testing
class TestDao extends Dao<Entity> {
  keyType: KeyType = 'uuid';
  constructor(api: StorageApi, network: NetworkService, batch: OfflineQueue) {
    super(api, network, batch, 'test-entities');
  }
}

describe('Dao', () => {
  let dao: TestDao;
  let storageApiMock: any;
  let networkServiceMock: any;
  let offlineQueueMock: any;

  const setup = (isOnline: boolean) => {
    storageApiMock = {
      environment: { url: 'http://localhost:3000' },
      token: { value: 'test-token' },
      remote: {
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      },
      local: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
    };

    networkServiceMock = {
      connected: isOnline,
      offline: { withQueue: true },
    };

    offlineQueueMock = {
      add: jest.fn(),
      remove: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: StorageApi, useValue: storageApiMock },
        { provide: NetworkService, useValue: networkServiceMock },
        { provide: OfflineQueue, useValue: offlineQueueMock },
      ],
    });

    dao = new TestDao(storageApiMock, networkServiceMock, offlineQueueMock);
  };

  describe('Online Mode', () => {
    beforeEach(() => setup(true));

    it('should create an entity via remote API', fakeAsync(async () => {
      const entity: Entity = { id: '1' };
      const response = new HttpResponse({ body: entity, status: 200 });
      storageApiMock.remote.post.mockReturnValue(of(response));

      await dao.create(entity).toPromise();

      expect(storageApiMock.remote.post).toHaveBeenCalled();
      expect(storageApiMock.local.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(entity));
    }));

    it('should update an entity via remote API', fakeAsync(async () => {
        const entity: Entity = { id: '1' };
        const response = new HttpResponse({ body: entity, status: 200 });
        storageApiMock.remote.put.mockReturnValue(of(response));
  
        await dao.update(entity).toPromise();
  
        expect(storageApiMock.remote.put).toHaveBeenCalled();
        expect(storageApiMock.local.set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(entity));
      }));
  
      it('should delete an entity via remote API', fakeAsync(async () => {
        const entity: Entity = { id: '1' };
        const response = new HttpResponse({ body: entity, status: 200 });
        storageApiMock.remote.delete.mockReturnValue(of(response));
  
        await dao.delete(entity).toPromise();
  
        expect(storageApiMock.remote.delete).toHaveBeenCalled();
        expect(storageApiMock.local.remove).toHaveBeenCalled();
      }));
  });

  describe('Offline Mode', () => {
    beforeEach(() => setup(false));

    it('should create an entity locally and add to offline queue', fakeAsync(async () => {
      const entity: Entity = { id: null }; // No ID, so one should be generated
      const response = await dao.create(entity).toPromise();
      expect(response.body.id).toBeDefined();

      expect(storageApiMock.local.set).toHaveBeenCalled();
      expect(offlineQueueMock.add).toHaveBeenCalledWith(expect.any(Object), { key: 'test-entities', action: 'add' });
    }));

    it('should update an entity locally and add to offline queue', fakeAsync(async () => {
        const entity: Entity = { id: '1' };
        await dao.update(entity).toPromise();
  
        expect(storageApiMock.local.set).toHaveBeenCalled();
        expect(offlineQueueMock.add).toHaveBeenCalledWith(entity, { key: 'test-entities', action: 'update' });
      }));
  
      it('should handle offline delete for UUID keys', fakeAsync(async () => {
        dao.keyType = 'uuid';
        const entity: Entity = { id: '123-abc' };
        await dao.delete(entity).toPromise();
  
        expect(storageApiMock.local.remove).toHaveBeenCalled();
        // For UUIDs, it should now add to the queue
        expect(offlineQueueMock.add).toHaveBeenCalledWith(entity, { key: 'test-entities', action: 'delete' });
      }));

      it('should handle offline delete for numeric keys (entity created online)', fakeAsync(async () => {
        dao.keyType = 'int';
        const entity: Entity = { id: 123 }; // An ID that would have come from the server
        await dao.delete(entity).toPromise();

        expect(offlineQueueMock.add).toHaveBeenCalledWith(entity, { key: 'test-entities', action: 'delete' });
      }));

      it('should handle offline delete for numeric keys (entity created offline)', fakeAsync(async () => {
        dao.keyType = 'int';
        const entity: Entity = { id: 9999999999 }; // An ID generated offline
        await dao.delete(entity).toPromise();

        // If the entity was created offline and then deleted offline, it should be removed from the queue
        expect(offlineQueueMock.remove).toHaveBeenCalledWith([entity], 'test-entities');
        expect(offlineQueueMock.add).not.toHaveBeenCalled();
      }));
  });

  describe('storeManyLocal', () => {
    beforeEach(() => setup(true));

    it('should merge paginated data without the forAll flag', fakeAsync(async () => {
      const localEntities: Entity[] = [{ id: '1' }, { id: '2' }];
      const remoteEntities: Entity[] = [{ id: '3' }, { id: '4' }];
      storageApiMock.local.get.mockResolvedValue(JSON.stringify(localEntities));

      await dao.storeManyLocal(remoteEntities).toPromise();

      const expectedMergedData = JSON.stringify([...remoteEntities, ...localEntities]);
      expect(storageApiMock.local.set).toHaveBeenCalledWith(dao.API_URL, expectedMergedData);
    }));

    it('should perform a full sync with the forAll flag', fakeAsync(async () => {
        dao.keyType = 'int';
        const localEntities: Entity[] = [{ id: 1 }, { id: 9999999999 }]; // One orphan, one offline-created
        const remoteEntities: Entity[] = [{ id: 2 }];
        storageApiMock.local.get.mockResolvedValue(JSON.stringify(localEntities));
        const unsetLocalSpy = jest.spyOn(dao, 'unsetLocal');
  
        await dao.storeManyLocal(remoteEntities, { forAll: true }).toPromise();
  
        const expectedData = JSON.stringify([...remoteEntities, { id: 9999999999 }]);
        expect(storageApiMock.local.set).toHaveBeenCalledWith(dao.API_URL, expectedData);
        // The orphan should be removed
        expect(unsetLocalSpy).toHaveBeenCalledWith({ id: 1 }, false);
      }));
  });
});
