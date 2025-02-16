import WebSocket from 'ws';
import { PatternMatch } from './patterns';
import { Trade } from '../types';
import Decimal from 'decimal.js';

const APP_ID = 1089;
const WS_URL = 'wss://ws.binaryws.com/websockets/v3';

export async function placeTrade(
  pattern: PatternMatch,
  stakeAmount: number
): Promise<Trade | null> {
  try {
    const socket = new WebSocket(WS_URL);
    
    const send = (request: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36);
        const message = { ...request, req_id: requestId };

        const handleMessage = (response: any) => {
          const data = JSON.parse(response.data.toString());
          if (data.req_id === requestId) {
            socket.removeEventListener('message', handleMessage);
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

    await new Promise((resolve) => {
      socket.onopen = resolve;
    });

    const proposal = await send({
      proposal: 1,
      amount: stakeAmount,
      basis: 'stake',
      contract_type: pattern.prediction === 'Up' ? 'CALL' : 'PUT',
      currency: 'USD',
      duration: 5,
      duration_unit: 't',
      symbol: 'R_100',
      app_id: APP_ID
    });

    if (proposal.error) {
      throw new Error(proposal.error.message);
    }

    const trade: Trade = {
      id: proposal.proposal.id,
      pattern: pattern.type,
      status: 'open',
      entryTime: new Date(),
      lastDigits: pattern.lastDigits,
      prediction: `${pattern.prediction} on ${pattern.type}`,
      stake: stakeAmount,
      profitLoss: 0
    };

    socket.close();
    return trade;
  } catch (error) {
    console.error('Failed to place trade:', error);
    return null;
  }
}