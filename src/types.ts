export interface Trade {
  id: string;
  pattern: 'OddEven' | 'MatchDiffer' | 'OverUnder';
  status: 'open' | 'closed';
  entryTime: Date;
  lastDigits: number[];
  prediction: string;
  stake: number;
  profitLoss: number;
}

export interface Pattern {
  type: 'OddEven' | 'MatchDiffer' | 'OverUnder';
  active: boolean;
  description: string;
  matches: number;
  lastUpdate: Date;
  winRate?: number;
}