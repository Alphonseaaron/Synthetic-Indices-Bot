import WebSocket from 'ws';
import Decimal from 'decimal.js';
import { create } from 'zustand';

const APP_ID = 1089;
const WS_URL = 'wss://ws.binaryws.com/websockets/v3';

interface DerivState {
  connection: WebSocket | null;
  balance: number;
  activeSymbol: string;
  ticks: number[];
  isAuthorized: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToTicks: (symbol: string) => void;
  unsubscribeFromTicks: () => void;
  authorize: (token: string) => Promise<void>;
}

export const useDerivStore = create<DerivState>((set, get) => {
  let socket: WebSocket | null = null;
  let ticksSubscription: any = null;

  const send = (request: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Socket not connected'));
        return;
      }

      const requestId = Math.random().toString(36);
      const message = { ...request, req_id: requestId };

      const handleMessage = (response: any) => {
        const data = JSON.parse(response.data.toString());
        if (data.req_id === requestId) {
          socket?.removeEventListener('message', handleMessage);
          if (data.error) {
            reject(data.error);
          } else {
            resolve(data);
          }
        }
      };

      socket.addEventListener('message', handleMessage);
      socket.send(JSON.stringify(message));
    });
  };

  return {
    connection: null,
    balance: 0,
    activeSymbol: 'R_100',
    ticks: [],
    isAuthorized: false,

    connect: async () => {
      try {
        if (socket) {
          socket.close();
        }

        socket = new WebSocket(WS_URL);
        
        await new Promise((resolve, reject) => {
          socket!.onopen = () => {
            console.log('Connected to Deriv WebSocket API');
            resolve(true);
          };
          socket!.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(error);
          };
        });

        set({ connection: socket });
      } catch (error) {
        console.error('Failed to connect:', error);
        setTimeout(() => {
          get().connect();
        }, 5000);
      }
    },

    disconnect: () => {
      if (socket) {
        socket.close();
        socket = null;
        set({ connection: null, isAuthorized: false });
      }
    },

    authorize: async (token: string) => {
      try {
        const response = await send({
          authorize: token,
          app_id: APP_ID
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        // Get initial balance and subscribe to updates
        const balanceResponse = await send({
          balance: 1,
          subscribe: 1
        });

        socket!.addEventListener('message', (event) => {
          const data = JSON.parse(event.data.toString());
          if (data.msg_type === 'balance') {
            set({ balance: new Decimal(data.balance.balance).toNumber() });
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
      }
    },

    subscribeToTicks: async (symbol: string) => {
      try {
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
          const data = JSON.parse(event.data.toString());
          if (data.msg_type === 'tick' && data.tick.symbol === symbol) {
            set(state => ({
              ticks: [...state.ticks.slice(-19), Number(data.tick.quote)]
            }));
          }
        });

        set({ activeSymbol: symbol });
      } catch (error) {
        console.error('Failed to subscribe to ticks:', error);
        setTimeout(() => {
          get().subscribeToTicks(symbol);
        }, 5000);
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