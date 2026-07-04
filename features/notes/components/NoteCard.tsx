import React from 'react';
import { Note, Project } from '../../../types';
import { formatPersianDate } from '../../../utils/dateUtils';
import { ListChecksIcon } from '../../../components/icons';
import { useData } from '../../../contexts/DataContext';

interface NoteCardProps {
  note: Note;
  project?: Project;
  onEdit: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, project, onEdit }) => {
  const { entityLinks } = useData();
  const isLinkedToTask = entityLinks.some(link => link.note_id === note.id);

  return (
    <div 
      onClick={() => onEdit(note)}
      className="group break-inside-avoid mb-6 cursor-pointer relative"
      dir="rtl"
    >
      {/* Background & Glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-[2rem] opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
      
      <div className="relative w-full bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40">
        {/* Project line accent */}
        {project && (
          <div 
            className="absolute top-0 right-0 left-0 h-1 opacity-55"
            style={{
              background: 'linear-gradient(to right, transparent, var(--project-color-' + (project?.color || 'sky') + '), transparent)'
            }}
          ></div>
        )}

        <div className="p-6 flex flex-col gap-4">
          {/* Header */}
          <div className="flex justify-between items-start gap-4 text-right">
            <h3 className="text-lg font-bold text-[var(--text-main)] leading-relaxed transition-colors">
              {note.title || "بدون عنوان"}
            </h3>
            {project && (
              <span className="flex-shrink-0 text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)] bg-[var(--bg-card)] px-2 py-1 rounded-md border border-[var(--border-subtle)] font-sans">
                {project.title}
              </span>
            )}
          </div>

          {/* Content Preview */}
          <p className="text-[var(--text-muted)] text-xs font-light leading-relaxed line-clamp-6 text-right whitespace-pre-wrap">
            {note.content}
          </p>

          {/* Footer: Meta & Tags */}
          <div className="pt-4 mt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 font-semibold">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-muted)] opacity-60 font-mono">
                {formatPersianDate(note.created_at)}
              </span>
              {isLinkedToTask && (
                <div className="flex items-center gap-1 bg-primary/10 text-[var(--color-primary-text)] border border-[var(--border-neon)] px-1.5 py-0.5 rounded-md text-[9px] font-extrabold" title="دارای کار متصل">
                  <ListChecksIcon className="w-3 h-3 text-[var(--color-primary-text)]" />
                  <span>کار متصل</span>
                </div>
              )}
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {note.tags.slice(0, 3).map(tag => (
                  <div key={tag} className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[9px] text-[var(--text-muted)] group-hover:bg-primary/10 group-hover:text-[var(--color-primary-text)] transition-colors">
                    <span className="opacity-50">#</span>
                    {tag}
                  </div>
                ))}
                {note.tags.length > 3 && (
                  <span className="text-[9px] text-[var(--text-muted)] opacity-65 font-bold">+{note.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
