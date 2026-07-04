import React from 'react';
import { ActionResult, Task, Note, Project } from '../../../types';
import { CheckIcon, ListChecksIcon, NotebookIcon, BriefcaseIcon, FlameIcon, LinkIcon } from '../../../components/icons';

interface ActionResultCardProps {
  result: ActionResult;
  onClick: (result: ActionResult) => void;
}

export const ActionResultCard: React.FC<ActionResultCardProps> = ({ result, onClick }) => {
  let icon = <CheckIcon className="w-5 h-5 text-on-primary"/>;
  let label = "آیتم ساخته شد";
  let title = "";

  if (result.type === 'task') {
    icon = <ListChecksIcon className="w-5 h-5 text-on-primary"/>;
    label = "تسک جدید";
    title = (result.data as Task).title;
  } else if (result.type === 'note') {
    icon = <NotebookIcon className="w-5 h-5 text-on-primary"/>;
    label = "یادداشت جدید";
    title = (result.data as Note).title;
  } else if (result.type === 'project') {
    icon = <BriefcaseIcon className="w-5 h-5 text-on-primary"/>;
    label = "پروژه جدید";
    title = (result.data as Project).title;
  } else if (result.type === 'habit') {
    icon = <FlameIcon className="w-5 h-5 text-on-primary"/>;
    label = "عادت جدید";
    title = (result.data as any).name;
  }

  return (
    <div className="mt-3 flex">
      <button 
        onClick={() => onClick(result)}
        className="flex items-center gap-3 glass-card border-subtle p-3 rounded-xl hover:bg-[var(--nav-hover-bg)] transition-all group w-full sm:w-auto min-w-[200px]"
      >
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/10">
          {icon}
        </div>
        <div className="text-right flex-1">
          <p className="text-xs text-muted font-medium mb-0.5">{label}</p>
          <p className="text-sm text-main font-bold group-hover:text-primary-text transition-colors">{title}</p>
        </div>
        <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-white/10 transition-colors">
          <LinkIcon className="w-4 h-4 text-muted group-hover:text-main" />
        </div>
      </button>
    </div>
  );
};
