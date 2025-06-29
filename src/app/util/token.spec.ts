import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { TokenService } from './token';

describe('TokenService', () => {
  let service: TokenService;
  let storageMock: {
    create: jest.Mock,
    get: jest.Mock,
    set: jest.Mock
  };

  beforeEach(() => {
    storageMock = {
      create: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null), // By default, no token is stored
      set: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        TokenService,
        { provide: Storage, useValue: storageMock }
      ]
    });

    // A service instance is created before each test, with a fresh mock
    service = TestBed.inject(TokenService);
  });

  it('should be created and initialize with no token', () => {
    expect(service).toBeTruthy();
    expect(storageMock.create).toHaveBeenCalled();
    expect(storageMock.get).toHaveBeenCalledWith('auth');
    expect(service.value).toBeNull();
  });

  it('should set token and update the observable value', async () => {
    const token = 'test-token';
    await service.set('auth', token);
    expect(storageMock.set).toHaveBeenCalledWith('auth', JSON.stringify({ token }));
    expect(service.value).toBe(token);
  });

  it('should initialize with a token if one is in storage', (done) => {
    const token = 'test-token';
    const localMock = {
        create: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(JSON.stringify({ token })),
        set: jest.fn()
    };

    // Create a new service instance to test constructor logic specifically
    const newService = new TokenService(localMock as any);

    expect(localMock.create).toHaveBeenCalled();
    expect(localMock.get).toHaveBeenCalledWith('auth');

    newService.token$.subscribe(t => {
      // The BehaviorSubject is initialized with null, so we skip that first emission
      if (t !== null) {
        expect(t).toBe(token);
        expect(newService.value).toBe(token);
        done();
      }
    });
  });
});
