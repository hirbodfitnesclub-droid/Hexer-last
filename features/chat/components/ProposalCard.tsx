import React, { useState } from 'react';
import { ExtractionProposal, Project } from '../../../types';
import { CheckIcon, XIcon, PencilIcon, ListChecksIcon, NotebookIcon, CalendarIcon, BriefcaseIcon } from '../../../components/icons';

interface ProposalCardProps {
  proposals: ExtractionProposal[];
  projects: Project[];
  onUpdateProposal: (id: string, updated: Partial<ExtractionProposal['draft']>) => void;
  onApproveProposal: (id: string) => void;
  onRejectProposal: (id: string) => void;
  onApproveAll: () => void;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposals,
  projects,
  onUpdateProposal,
  onApproveProposal,
  onRejectProposal,
  onApproveAll
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editProject, setEditProject] = useState<string>('');

  const handleStartEdit = (prop: ExtractionProposal) => {
    setEditingId(prop.id);
    setEditTitle(prop.draft.title || '');
    setEditDesc(prop.draft.description || '');
    setEditContent(prop.draft.content || '');
    setEditPriority(prop.draft.priority || 'medium');
    setEditDueDate(prop.draft.dueDate || '');
    setEditProject(prop.draft.project_id || '');
  };

  const handleSaveEdit = (id: string, kind: 'task' | 'note') => {
    onUpdateProposal(id, {
      title: editTitle,
      description: kind === 'task' ? editDesc : undefined,
      content: kind === 'note' ? editContent : undefined,
      priority: kind === 'task' ? editPriority : undefined,
      dueDate: kind === 'task' ? editDueDate : undefined,
      project_id: editProject || null
    });
    setEditingId(null);
  };

  const pendingProposals = proposals.filter(p => p.status === 'pending');

  if (proposals.length === 0) return null;

  return (
    <div className="mt-4 glass-card border-subtle rounded-2xl p-4 w-full">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-primary-text flex items-center gap-1.5">
          <ListChecksIcon className="w-4 h-4" />
          پیشنهادات استخراج‌شده توسط هوش مصنوعی
        </h4>
        {pendingProposals.length > 0 && (
          <button
            onClick={onApproveAll}
            className="text-xs bg-brand hover:bg-[var(--color-primary-hover)] font-bold px-3 py-1.5 rounded-lg text-[var(--text-on-primary)] transition-all shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)]"
          >
            تأیید همه پیشنهادات
          </button>
        )}
      </div>

      <div className="space-y-3">
        {proposals.map((prop) => {
          const isPending = prop.status === 'pending';
          const isApproved = prop.status === 'approved';
          const isRejected = prop.status === 'rejected';
          const isEditing = editingId === prop.id;

          return (
            <div 
              key={prop.id} 
              className={`p-3.5 rounded-xl border transition-all ${
                isApproved 
                  ? 'bg-primary/5 border-[var(--border-neon)]' 
                  : isRejected 
                    ? 'bg-[var(--semantic-error-soft)] border-error/20 opacity-50' 
                    : 'glass-card border-subtle hover:border-primary/30'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary-text">
                    {prop.kind === 'task' ? <ListChecksIcon className="w-4 h-4"/> : <NotebookIcon className="w-4 h-4"/>}
                  </div>
                  <span className="text-xs font-bold text-muted">
                    {prop.kind === 'task' ? 'تسک پیشنهادی' : 'یادداشت پیشنهادی'}
                  </span>
                  <span className="text-[10px] text-muted bg-white/5 px-1.5 py-0.5 rounded">
                    اطمینان: {Math.round(prop.confidence * 100)}٪
                  </span>
                </div>

                {isPending && !isEditing && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(prop)}
                      className="p-1 text-muted hover:text-main hover:bg-white/5 rounded-md transition-colors"
                      title="ویرایش پیش‌نویس"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onApproveProposal(prop.id)}
                      className="p-1 text-primary-text hover:bg-primary/10 rounded-md transition-colors"
                      title="تأیید و ساخت"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRejectProposal(prop.id)}
                      className="p-1 text-error hover:bg-error/10 rounded-md transition-colors"
                      title="حذف پیشنهاد"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {!isPending && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isApproved ? 'bg-primary/10 text-primary-text' : 'bg-[var(--semantic-error-soft)] text-error'
                  }`}>
                    {isApproved ? 'تأیید شد' : 'رد شد'}
                  </span>
                )}
              </div>

              {isEditing ? (
                // Edit mode
                <div className="space-y-3 mt-2 text-right" dir="rtl">
                  <div>
                    <label className="text-[10px] text-muted font-medium block mb-1">عنوان</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-sm text-main focus:outline-none focus:border-[var(--input-focus-ring)]"
                    />
                  </div>

                  {prop.kind === 'task' ? (
                    <>
                      <div>
                        <label className="text-[10px] text-muted font-medium block mb-1">توضیحات</label>
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-sm text-main min-h-[50px] focus:outline-none focus:border-[var(--input-focus-ring)]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted font-medium block mb-1">اولویت</label>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as any)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs text-main focus:outline-none focus:border-[var(--input-focus-ring)]"
                          >
                            <option value="low">کم</option>
                            <option value="medium">متوسط</option>
                            <option value="high">زیاد</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted font-medium block mb-1">تاریخ سررسید</label>
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs text-main focus:outline-none focus:border-[var(--input-focus-ring)]"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[10px] text-muted font-medium block mb-1">محتوا</label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-sm text-main min-h-[70px] focus:outline-none focus:border-[var(--input-focus-ring)]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-muted font-medium block mb-1">پروژه مرتبط</label>
                    <select
                      value={editProject}
                      onChange={(e) => setEditProject(e.target.value)}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-2 text-xs text-main focus:outline-none focus:border-[var(--input-focus-ring)]"
                    >
                      <option value="">(بدون پروژه)</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                       onClick={() => handleSaveEdit(prop.id, prop.kind)}
                       className="text-xs bg-brand hover:bg-[var(--color-primary-hover)] font-bold px-3 py-1.5 rounded-lg text-[var(--text-on-primary)] transition-all shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.15)]"
                    >
                      ذخیره پیش‌نویس
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs glass-card border-subtle hover:bg-[var(--nav-hover-bg)] font-bold px-3 py-1.5 rounded-lg text-main transition-all"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="text-right" dir="rtl">
                  <h5 className="text-sm font-bold text-main mb-1">
                    {prop.draft.title || '(بدون عنوان)'}
                  </h5>
                  {prop.kind === 'task' ? (
                    <>
                      {prop.draft.description && (
                        <p className="text-xs text-muted mb-2 line-clamp-2">
                          {prop.draft.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted">
                        {prop.draft.dueDate && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <CalendarIcon className="w-3 h-3 text-primary-text" />
                            سررسید: {prop.draft.dueDate}
                          </span>
                        )}
                        {prop.draft.priority && (
                          <span className={`px-2 py-0.5 rounded ${
                            prop.draft.priority === 'high' 
                              ? 'bg-error/10 text-error' 
                              : prop.draft.priority === 'medium' 
                                ? 'bg-primary/10 text-primary-text' 
                                : 'bg-primary/5 text-muted'
                          }`}>
                            اولویت: {prop.draft.priority === 'high' ? 'زیاد' : prop.draft.priority === 'medium' ? 'متوسط' : 'کم'}
                          </span>
                        )}
                        {prop.draft.project_id && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <BriefcaseIcon className="w-3 h-3 text-primary-text" />
                            پروژه: {projects.find(p => p.id === prop.draft.project_id)?.title || 'مرتبط'}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {prop.draft.content && (
                        <p className="text-xs text-muted mb-2 whitespace-pre-wrap line-clamp-3">
                          {prop.draft.content}
                        </p>
                      )}
                      {prop.draft.project_id && (
                        <div className="flex text-[10px] text-muted">
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <BriefcaseIcon className="w-3 h-3 text-primary-text" />
                            پروژه: {projects.find(p => p.id === prop.draft.project_id)?.title || 'مرتبط'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
