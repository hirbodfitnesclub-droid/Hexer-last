import React from 'react';
import { Citation } from '../../../types';
import { ListChecksIcon, NotebookIcon, LinkIcon, BriefcaseIcon } from '../../../components/icons';

interface CitationCardProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

export const CitationCard: React.FC<CitationCardProps> = ({ citation, onClick }) => {
  const isTask = citation.type === 'task';
  const isNote = citation.type === 'note';
  const isProject = citation.type === 'project';

  let iconBgColor = 'bg-purple-500/10 text-purple-400';
  let iconComponent = <NotebookIcon className="w-3.5 h-3.5"/>;
  let sourceTypeLabel = 'یادداشت مرتبط';

  if (isTask) {
    iconBgColor = 'bg-green-500/10 text-green-400';
    iconComponent = <ListChecksIcon className="w-3.5 h-3.5"/>;
    sourceTypeLabel = 'تسک مرتبط';
  } else if (isProject) {
    iconBgColor = 'bg-sky-500/10 text-sky-400';
    iconComponent = <BriefcaseIcon className="w-3.5 h-3.5"/>;
    sourceTypeLabel = 'پروژه مرتبط';
  } else {
    sourceTypeLabel = 'منبع مرتبط';
  }

  return (
    <button 
      onClick={() => onClick(citation)}
      className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-700/80 border border-white/5 hover:border-sky-500/30 rounded-lg p-2 transition-all group text-right w-full sm:w-auto"
    >
      <div className={`p-1.5 rounded-md ${iconBgColor}`}>
        {iconComponent}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 truncate max-w-[150px]">{citation.title}</p>
        <p className="text-[10px] text-gray-500">{sourceTypeLabel}</p>
      </div>
      <LinkIcon className="w-3 h-3 text-gray-600 group-hover:text-sky-400 transition-colors" />
    </button>
  );
};
