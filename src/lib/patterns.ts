import { Trade } from '../types';
import Decimal from 'decimal.js';

export interface PatternMatch {
  type: Trade['pattern'];
  lastDigits: number[];
  prediction: 'Up' | 'Down';
  confidence: number;
}

export function analyzePatterns(ticks: number[]): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const lastDigits = ticks.map(tick => Number(tick.toString().slice(-1)));

  // Analyze last 5 digits for better pattern recognition
  const last5 = lastDigits.slice(-5);
  const last3 = last5.slice(-3);
  
  // OddEven Pattern - Enhanced to monitor both even and odd sequences
  const isEven = (n: number) => n % 2 === 0;
  const evenCount = last3.filter(isEven).length;
  const oddCount = last3.filter(n => !isEven(n)).length;
  
  if (evenCount >= 2 || oddCount >= 2) {
    const dominantPattern = evenCount >= 2 ? 'even' : 'odd';
    const confidence = Math.max(evenCount, oddCount) / 3;
    
    matches.push({
      type: 'OddEven',
      lastDigits: last3,
      // If we see a strong even pattern, predict odd next (mean reversion)
      prediction: dominantPattern === 'even' ? 'Down' : 'Up',
      confidence: confidence
    });
  }

  // MatchDiffer Pattern - Look for repeating or alternating sequences
  const uniqueDigits = new Set(last3).size;
  const hasRepeatingSequence = last5.some((digit, index) => 
    index < last5.length - 2 && 
    digit === last5[index + 1] && 
    digit === last5[index + 2]
  );
  
  const hasAlternatingSequence = last5.some((digit, index) => 
    index < last5.length - 2 && 
    digit === last5[index + 2] && 
    last5[index + 1] !== digit
  );

  if (hasRepeatingSequence || hasAlternatingSequence || uniqueDigits === 1) {
    matches.push({
      type: 'MatchDiffer',
      lastDigits: last3,
      prediction: hasRepeatingSequence || uniqueDigits === 1 ? 'Down' : 'Up',
      confidence: hasRepeatingSequence ? 0.85 : hasAlternatingSequence ? 0.75 : 0.7
    });
  }

  // OverUnder Pattern - Enhanced with trend analysis
  const overCount = last5.filter(n => n >= 5).length;
  const underCount = last5.filter(n => n < 5).length;
  const trendStrength = Math.abs(overCount - underCount) / 5;
  
  if (trendStrength > 0.4) { // Only trigger if there's a clear trend
    matches.push({
      type: 'OverUnder',
      lastDigits: last3,
      prediction: overCount > underCount ? 'Down' : 'Up', // Mean reversion
      confidence: trendStrength
    });
  }

  return matches;
}

export function calculateStakeAmount(balance: number): number {
  // Calculate 1% of account balance with minimum stake protection
  const stake = new Decimal(balance).mul(0.01).toDecimalPlaces(2);
  return stake.lessThan(1) ? 1 : stake.toNumber(); // Minimum stake of 1
}