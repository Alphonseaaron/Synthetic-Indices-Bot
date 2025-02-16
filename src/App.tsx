import React, { useState, useEffect } from 'react';
import { Pattern, Trade } from './types';
import { PatternCard } from './components/PatternCard';
import { TradesList } from './components/TradesList';
import { Bot, PauseCircle, PlayCircle, AlertCircle } from 'lucide-react';
import { useDerivStore } from './lib/deriv';
import { analyzePatterns, calculateStakeAmount } from './lib/patterns';
import { placeTrade } from './lib/trading';

const API_TOKEN = 'zxPtNisG7NStj1D';

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { 
    connect, 
    disconnect, 
    authorize, 
    subscribeToTicks,
    unsubscribeFromTicks,
    isAuthorized,
    balance,
    ticks
  } = useDerivStore();

  const [patterns, setPatterns] = useState<Pattern[]>([
    {
      type: 'OddEven',
      active: true,
      description: 'Monitors even digits (2,4,6,8) occurring twice in sequence',
      matches: 0,
      lastUpdate: new Date(),
      winRate: 0
    },
    {
      type: 'MatchDiffer',
      active: false,
      description: 'Tracks repeating digits (e.g., 3-3-3) or alternating patterns',
      matches: 0,
      lastUpdate: new Date(),
      winRate: 0
    },
    {
      type: 'OverUnder',
      active: false,
      description: 'Analyzes digits falling under 5 (0-4) or over 5 (5-9)',
      matches: 0,
      lastUpdate: new Date(),
      winRate: 0
    },
  ]);

  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    // Initialize connection
    connect().then(() => {
      authorize(API_TOKEN).catch(err => {
        setError('Authorization failed. Please check your API token.');
        console.error(err);
      });
    }).catch(err => {
      setError('Connection failed. Please try again.');
      console.error(err);
    });

    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isRunning || !isAuthorized) return;

    const activePatternTypes = patterns
      .filter(p => p.active)
      .map(p => p.type);

    if (activePatternTypes.length === 0) return;

    // Subscribe to ticks
    subscribeToTicks('R_100');

    // Analyze patterns and place trades
    const interval = setInterval(() => {
      if (ticks.length < 3) return;

      const patternMatches = analyzePatterns(ticks);
      const stakeAmount = calculateStakeAmount(balance);

      patternMatches.forEach(async match => {
        if (activePatternTypes.includes(match.type) && match.confidence > 0.7) {
          const trade = await placeTrade(match, stakeAmount);
          if (trade) {
            setTrades(current => [...current, trade]);
            setPatterns(current =>
              current.map(p =>
                p.type === match.type
                  ? { ...p, matches: p.matches + 1, lastUpdate: new Date() }
                  : p
              )
            );
          }
        }
      });
    }, 5000);

    return () => {
      clearInterval(interval);
      unsubscribeFromTicks();
    };
  }, [isRunning, isAuthorized, patterns, ticks, balance]);

  const togglePattern = (type: Pattern['type']) => {
    setPatterns(patterns.map(p => 
      p.type === type ? { ...p, active: !p.active } : p
    ));
  };

  const toggleBot = () => {
    if (!isAuthorized && !isRunning) {
      setError('Please ensure you are authorized before starting the bot.');
      return;
    }
    setIsRunning(!isRunning);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Synthetic Indices Bot
              </h1>
              <p className="text-sm text-gray-600">
                Balance: ${balance.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            <button
              onClick={toggleBot}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                isRunning
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isRunning ? (
                <>
                  <PauseCircle className="w-5 h-5" />
                  Stop Bot
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" />
                  Start Bot
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.type}
              pattern={pattern}
              onToggle={togglePattern}
            />
          ))}
        </div>

        <TradesList trades={trades} />
      </div>
    </div>
  );
}

export default App;