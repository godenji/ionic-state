import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { Network, ConnectionStatus } from '@capacitor/network';
import { NetworkService } from './network';
import { firstValueFrom, skip } from 'rxjs';

// Mock Capacitor Network plugin
jest.mock('@capacitor/network', () => ({
  Network: {
    getStatus: jest.fn(),
    addListener: jest.fn(),
  },
}));

describe('NetworkService', () => {
  let service: NetworkService;
  let platformMock: Partial<Platform>;
  let networkAddListenerCallback: (status: ConnectionStatus) => void;

  const setup = (initialStatus: ConnectionStatus, isHybrid = false) => {
    // Reset mocks before each test
    (Network.getStatus as jest.Mock).mockResolvedValue(initialStatus);
    (Network.addListener as jest.Mock).mockImplementation((_, callback) => {
      networkAddListenerCallback = callback;
      return { remove: jest.fn() };
    });

    platformMock = {
      is: jest.fn().mockReturnValue(isHybrid),
    };

    TestBed.configureTestingModule({
      providers: [
        NetworkService,
        { provide: Platform, useValue: platformMock },
      ],
    });

    service = TestBed.inject(NetworkService);
  };

  it('should be created', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' });
    tick();
    expect(service).toBeTruthy();
  }));

  it('should initialize with the correct connection status', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' });
    tick();
    expect(service.connected).toBe(true);
    firstValueFrom(service.connected$).then(connected => {
      expect(connected).toBe(true);
    });
  }));

  it('should set isNative based on platform', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' }, true);
    tick();
    expect(platformMock.is).toHaveBeenCalledWith('hybrid');
    expect(service.isNative).toBe(true);
  }));

  it('should update connection status on network change', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' });
    tick();
    expect(service.connected).toBe(true);

    // Simulate network status change
    networkAddListenerCallback({ connected: false, connectionType: 'none' });
    tick();

    expect(service.connected).toBe(false);
    firstValueFrom(service.connected$).then(connected => {
      expect(connected).toBe(false);
    });
  }));

  it('should reflect offline mode in connected status', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' });
    tick();
    expect(service.connected).toBe(true);

    // Enable offline mode
    service.offline = { enabled: true, withQueue: true };
    tick();

    expect(service.connected).toBe(false);
    firstValueFrom(service.connected$).then(connected => {
      expect(connected).toBe(false);
    });

    // Disable offline mode
    service.offline = { enabled: false, withQueue: true };
    tick();
    expect(service.connected).toBe(true);
  }));

  it('should return correct offline properties', fakeAsync(() => {
    setup({ connected: true, connectionType: 'unknown' });
    tick();
    const offlineProps = { enabled: true, withQueue: false };
    service.offline = offlineProps;
    expect(service.offline).toEqual(offlineProps);
  }));
});
