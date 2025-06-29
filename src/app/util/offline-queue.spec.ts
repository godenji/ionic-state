import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { OfflineQueue, storageKey } from './offline-queue';
import { Entity } from '../model/entity';

describe('OfflineQueue', () => {
  let service: OfflineQueue;
  let storageMock: {
    get: jest.Mock,
    set: jest.Mock,
  };

  const setup = (initialData: any = null) => {
    storageMock = {
      get: jest.fn().mockResolvedValue(initialData),
      set: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        OfflineQueue,
        { provide: Storage, useValue: storageMock },
      ],
    });

    service = TestBed.inject(OfflineQueue);
  };

  it('should be created', fakeAsync(() => {
    setup();
    tick();
    expect(service).toBeTruthy();
  }));

  it('should initialize queue from storage', fakeAsync(() => {
    const initialQueue = { testKey: [{ entity: { id: '1' }, action: 'add' }] };
    setup(JSON.stringify(initialQueue));
    tick();
    expect(storageMock.get).toHaveBeenCalledWith(storageKey);
    expect(service.queue).toEqual(initialQueue);
  }));

  it('should add a single entity to the queue', fakeAsync(() => {
    setup();
    tick();
    const entity: Entity = { id: '1' };
    service.add(entity, { key: 'testKey', action: 'add' });
    expect(service.queue['testKey']).toHaveLength(1);
    expect(service.queue['testKey'][0]).toEqual({ entity, action: 'add' });
    expect(storageMock.set).toHaveBeenCalledWith(storageKey, JSON.stringify(service.queue));
  }));

  it('should add multiple entities to the queue', fakeAsync(() => {
    setup();
    tick();
    const entities: Entity[] = [{ id: '1' }, { id: '2' }];
    service.add(entities, { key: 'testKey', action: 'add' });
    expect(service.queue['testKey']).toHaveLength(2);
    expect(storageMock.set).toHaveBeenCalledWith(storageKey, JSON.stringify(service.queue));
  }));

  it('should update an existing entity in the queue', fakeAsync(() => {
    setup();
    tick();
    const entity: Entity = { id: '1' };
    service.add(entity, { key: 'testKey', action: 'add' });

    const updatedEntity: Entity = { id: '1' };
    service.add(updatedEntity, { key: 'testKey', action: 'update' });

    expect(service.queue['testKey']).toHaveLength(1);
    expect(service.queue['testKey'][0]).toEqual({ entity: updatedEntity, action: 'update' });
  }));

  it('should remove a single entity from the queue', fakeAsync(() => {
    const entity: Entity = { id: '1' };
    const initialQueue = { testKey: [{ entity, action: 'add' }] };
    setup(JSON.stringify(initialQueue));
    tick();

    service.remove(entity, 'testKey');
    expect(service.queue['testKey']).toHaveLength(0);
    expect(storageMock.set).toHaveBeenCalledWith(storageKey, JSON.stringify(service.queue));
  }));

  it('should remove multiple entities from the queue', fakeAsync(() => {
    const entities: Entity[] = [{ id: '1' }, { id: '2' }];
    const initialQueue = { testKey: entities.map(e => ({ entity: e, action: 'add' })) };
    setup(JSON.stringify(initialQueue));
    tick();

    service.remove(entities, 'testKey');
    expect(service.queue['testKey']).toHaveLength(0);
  }));

  it('should clear the queue', fakeAsync(() => {
    const initialQueue = { testKey: [{ entity: { id: '1' }, action: 'add' }] };
    setup(JSON.stringify(initialQueue));
    tick();

    service.clear();
    expect(service.queue).toEqual({});
    expect(storageMock.set).toHaveBeenCalledWith(storageKey, JSON.stringify({}));
  }));
});
