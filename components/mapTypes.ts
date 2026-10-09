import type { Pedido } from '../types/pedido';

export type MapCoordinate = { lat: number; lng: number };
export type MapaProps = {
  pedidos: Pedido[];
  emEntrega: boolean;
  recenterToken?: number;
  retryToken?: number;
  sessionKey?: string;
  routeMode?: boolean;
  mapClean?: boolean;
  onOrderPress?: (pedidoId: number) => void;
  onMapPress?: () => void;
  view3D?: boolean;
  navigationEnabled?: boolean;
  collectionDestination?: MapCoordinate;
  selectedPedidoId?: number;
  onNavigationState?: (state: { status: 'loading' | 'ready' | 'guiding' | 'arrived' | 'rerouting' | 'error'; message?: string; meters?: number; seconds?: number }) => void;
  path?: MapCoordinate[];
  pathSegments?: MapCoordinate[][];
  historical?: boolean;
};
