import WebSocket from 'ws';
import Decimal from 'decimal.js';
import { create } from 'zustand';

const APP_ID = 1089;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`;
const PING_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds

interface DerivState {
  connection: WebSocket | null;
  balance: number;
  activeSymbol: string;
  ticks: number[];
  isAuthorized: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToTicks: (symbol: string) => void;
  unsubscribeFromTicks: () => void;
  authorize: (token: string) => Promise<void>;
}

export const useDerivStore = create<DerivState>((set, get) => {
  let socket: WebSocket | null = null;
  let ticksSubscription: any = null;
  let pingInterval: NodeJS.Timeout | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  const clearTimeouts = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  const setupPingInterval = () => {
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ ping: 1 }));
      }
    }, PING_INTERVAL);
  };

  const send = (request: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Socket not connected'));
        return;
      }

      const requestId = Math.random().toString(36).substring(2, 15);
      const message = { ...request, req_id: requestId };

      let messageTimeout = setTimeout(() => {
        socket?.removeEventListener('message', handleMessage);
        reject(new Error('Request timeout'));
      }, 10000);

      const handleMessage = (response: any) => {
        try {
          const data = JSON.parse(response.data.toString());
          if (data.req_id === requestId) {
            clearTimeout(messageTimeout);
            socket?.removeEventListener('message', handleMessage);
            if (data.error) {
              reject(new Error(data.error.message));
            } else {
              resolve(data);
            }
          }
        } catch (error) {
          clearTimeout(messageTimeout);
          reject(new Error('Failed to parse WebSocket message'));
        }
      };

      socket.addEventListener('message', handleMessage);
      
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(messageTimeout);
        reject(new Error('Failed to send message'));
      }
    });
  };

  const handleSocketError = (error: any) => {
    console.error('WebSocket error:', error);
    set({ isAuthorized: false, isConnecting: false });
    clearTimeouts();
    
    reconnectTimeout = setTimeout(() => {
      if (get().connection) {
        get().connect();
      }
    }, RECONNECT_DELAY);
  };

  return {
    connection: null,
    balance: 0,
    activeSymbol: 'R_100',
    ticks: [],
    isAuthorized: false,
    isConnecting: false,

    connect: async () => {
      return new Promise((resolve, reject) => {
        try {
          if (socket) {
            socket.close();
            clearTimeouts();
          }

          set({ isConnecting: true });
          socket = new WebSocket(WS_URL);
          
          const connectionTimeout = setTimeout(() => {
            if (socket?.readyState !== WebSocket.OPEN) {
              socket?.close();
              set({ isConnecting: false });
              reject(new Error('Connection timeout'));
            }
          }, 10000);

          socket.onopen = () => {
            clearTimeout(connectionTimeout);
            console.log('Connected to Deriv WebSocket API');
            setupPingInterval();
            set({ connection: socket, isConnecting: false });
            resolve();
          };

          socket.onerror = handleSocketError;

          socket.onclose = () => {
            console.log('WebSocket connection closed');
            set({ isAuthorized: false, connection: null, isConnecting: false });
            clearTimeouts();
            
            // Attempt to reconnect if not explicitly disconnected
            if (get().connection) {
              reconnectTimeout = setTimeout(() => {
                get().connect();
              }, RECONNECT_DELAY);
            }
          };

        } catch (error) {
          console.error('Failed to connect:', error);
          set({ isConnecting: false });
          reject(error);
        }
      });
    },

    disconnect: () => {
      clearTimeouts();
      if (socket) {
        socket.close();
        socket = null;
        set({ 
          connection: null, 
          isAuthorized: false, 
          isConnecting: false,
          balance: 0,
          ticks: []
        });
      }
    },

    authorize: async (token: string) => {
      try {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          await get().connect();
        }

        const response = await send({
          authorize: token,
          app_id: APP_ID
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const balanceResponse = await send({
          balance: 1,
          subscribe: 1
        });

        socket!.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            if (data.msg_type === 'balance') {
              set({ balance: new Decimal(data.balance.balance).toNumber() });
            }
          } catch (error) {
            console.error('Failed to parse balance update:', error);
          }
        });

        set({ 
          isAuthorized: true,
          balance: new Decimal(balanceResponse.balance.balance).toNumber()
        });

        console.log('Successfully authorized');
      } catch (error) {
        console.error('Authorization failed:', error);
        set({ isAuthorized: false });
        throw error;
      }
    },

    subscribeToTicks: async (symbol: string) => {
      try {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          await get().connect();
        }

        if (ticksSubscription) {
          await send({ forget: ticksSubscription });
          ticksSubscription = null;
        }

        const response = await send({
          ticks: symbol,
          subscribe: 1
        });

        ticksSubscription = response.subscription?.id;

        socket!.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            if (data.msg_type === 'tick' && data.tick.symbol === symbol) {
              set(state => ({
                ticks: [...state.ticks.slice(-19), Number(data.tick.quote)]
              }));
            }
          } catch (error) {
            console.error('Failed to parse tick data:', error);
          }
        });

        set({ activeSymbol: symbol });
      } catch (error) {
        console.error('Failed to subscribe to ticks:', error);
        setTimeout(() => {
          if (get().isAuthorized) {
            get().subscribeToTicks(symbol);
          }
        }, RECONNECT_DELAY);
      }
    },

    unsubscribeFromTicks: async () => {
      try {
        if (ticksSubscription) {
          await send({ forget: ticksSubscription });
          ticksSubscription = null;
        }
      } catch (error) {
        console.error('Failed to unsubscribe from ticks:', error);
      }
    }
  };
});