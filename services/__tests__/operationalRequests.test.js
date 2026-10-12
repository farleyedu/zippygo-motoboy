import { createOperationalRequestCoordinator } from '../operationalRequests';

test('reaproveita heartbeat por quatro minutos, renova no limite e permite retomada imediata', async () => {
  let now = 0;
  const coordinator = createOperationalRequestCoordinator(() => now);
  const request = jest.fn(async () => ({ accessToken: 'novo', session: { heartbeatIntervalSeconds: 240, isEnded: false } }));
  await coordinator.heartbeat('original', request);
  now = 239999;
  await coordinator.heartbeat('novo', request);
  expect(request).toHaveBeenCalledTimes(1);
  now = 240000;
  await coordinator.heartbeat('novo', request);
  expect(request).toHaveBeenCalledTimes(2);
  await coordinator.heartbeat('novo', request, true);
  expect(request).toHaveBeenCalledTimes(3);
});

test('compartilha chamadas simultâneas sem reutilizar presença de outro turno', async () => {
  const coordinator = createOperationalRequestCoordinator();
  const request = jest.fn(async () => ({ accessToken: 'renovado', session: { heartbeatIntervalSeconds: 240, isEnded: false } }));
  await Promise.all([coordinator.heartbeat('a', request), coordinator.heartbeat('a', request)]);
  expect(request).toHaveBeenCalledTimes(1);
  await coordinator.heartbeat('b', request);
  expect(request).toHaveBeenCalledTimes(2);
});
