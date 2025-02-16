import React from 'react';
import { Switch } from './Switch';
import { Pattern } from '../types';
import { Activity, GitBranch, Hash } from 'lucide-react';

interface PatternCardProps {
  pattern: Pattern;
  onToggle: (type: Pattern['type']) => void;
}

const icons = {
  OddEven: Hash,
  MatchDiffer: GitBranch,
  OverUnder: Activity,
};

export function PatternCard({ pattern, onToggle }: PatternCardProps) {
  const Icon = icons[pattern.type];
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">{pattern.type} Pattern</h3>
        </div>
        <Switch checked={pattern.active} onChange={() => onToggle(pattern.type)} />
      </div>
      <p className="text-sm text-gray-600 mb-3">{pattern.description}</p>
      <div className="mt-auto flex justify-between text-sm">
        <span className="text-gray-500">Matches: {pattern.matches}</span>
        <span className="text-gray-500">
          Updated: {pattern.lastUpdate.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}