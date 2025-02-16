import React from 'react';
import { Trade } from '../types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradesListProps {
  trades: Trade[];
}

export function TradesList({ trades }: TradesListProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Active Trades</h3>
      </div>
      <div className="divide-y divide-gray-200 max-h-[400px] overflow-auto">
        {trades.map((trade) => (
          <div key={trade.id} className="p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-gray-900">{trade.pattern}</span>
                <span className="ml-2 text-sm text-gray-500">
                  {trade.entryTime.toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  trade.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {trade.status}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  trade.profitLoss >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  ${Math.abs(trade.profitLoss).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Last digits: {trade.lastDigits.join(', ')}</span>
              <span className="flex items-center gap-1">
                Prediction: {trade.prediction}
                {trade.prediction.includes('Up') ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
              </span>
              <span>Stake: ${trade.stake}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}