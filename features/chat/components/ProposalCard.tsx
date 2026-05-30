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
    <div className="mt-4 bg-gray-900/60 border border-white/10 rounded-2xl p-4 w-full">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
          <ListChecksIcon className="w-4 h-4" />
          پیشنهادات استخراج‌شده توسط هوش مصنوعی
        </h4>
        {pendingProposals.length > 0 && (
          <button
            onClick={onApproveAll}
            className="text-xs bg-sky-500 hover:bg-sky-600 font-bold px-3 py-1.5 rounded-lg text-white transition-all shadow-lg shadow-sky-500/15"
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
                  ? 'bg-green-500/5 border-green-500/20' 
                  : isRejected 
                    ? 'bg-red-500/5 border-red-500/20 opacity-50' 
                    : 'bg-gray-800/80 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${prop.kind === 'task' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {prop.kind === 'task' ? <ListChecksIcon className="w-4 h-4"/> : <NotebookIcon className="w-4 h-4"/>}
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    {prop.kind === 'task' ? 'تسک پیشنهادی' : 'یادداشت پیشنهادی'}
                  </span>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                    اطمینان: {Math.round(prop.confidence * 100)}٪
                  </span>
                </div>

                {isPending && !isEditing && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(prop)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                      title="ویرایش پیش‌نویس"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onApproveProposal(prop.id)}
                      className="p-1 text-green-400 hover:bg-green-500/10 rounded-md transition-colors"
                      title="تأیید و ساخت"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRejectProposal(prop.id)}
                      className="p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="حذف پیشنهاد"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {!isPending && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isApproved ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {isApproved ? 'تأیید شد' : 'رد شد'}
                  </span>
                )}
              </div>

              {isEditing ? (
                // Edit mode
                <div className="space-y-3 mt-2 text-right" dir="rtl">
                  <div>
                    <label className="text-[10px] text-gray-400 font-medium block mb-1">عنوان</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {prop.kind === 'task' ? (
                    <>
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">توضیحات</label>
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-sm text-white min-h-[50px] focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 font-medium block mb-1">اولویت</label>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as any)}
                            className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                          >
                            <option value="low">کم</option>
                            <option value="medium">متوسط</option>
                            <option value="high">زیاد</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-medium block mb-1">تاریخ سررسید</label>
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[10px] text-gray-400 font-medium block mb-1">محتوا</label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-sm text-white min-h-[70px] focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-gray-400 font-medium block mb-1">پروژه مرتبط</label>
                    <select
                      value={editProject}
                      onChange={(e) => setEditProject(e.target.value)}
                      className="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                      className="text-xs bg-green-600 hover:bg-green-700 font-bold px-3 py-1.5 rounded-lg text-white transition-all"
                    >
                      ذخیره پیش‌نویس
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 font-bold px-3 py-1.5 rounded-lg text-gray-300 transition-all"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="text-right" dir="rtl">
                  <h5 className="text-sm font-bold text-white mb-1">
                    {prop.draft.title || '(بدون عنوان)'}
                  </h5>
                  {prop.kind === 'task' ? (
                    <>
                      {prop.draft.description && (
                        <p className="text-xs text-gray-450 mb-2 line-clamp-2">
                          {prop.draft.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                        {prop.draft.dueDate && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <CalendarIcon className="w-3 h-3 text-sky-400" />
                            سررسید: {prop.draft.dueDate}
                          </span>
                        )}
                        {prop.draft.priority && (
                          <span className={`px-2 py-0.5 rounded ${
                            prop.draft.priority === 'high' 
                              ? 'bg-red-500/10 text-red-400' 
                              : prop.draft.priority === 'medium' 
                                ? 'bg-orange-500/10 text-orange-400' 
                                : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            اولویت: {prop.draft.priority === 'high' ? 'زیاد' : prop.draft.priority === 'medium' ? 'متوسط' : 'کم'}
                          </span>
                        )}
                        {prop.draft.project_id && (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <BriefcaseIcon className="w-3 h-3 text-purple-400" />
                            پروژه: {projects.find(p => p.id === prop.draft.project_id)?.title || 'مرتبط'}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {prop.draft.content && (
                        <p className="text-xs text-gray-400 mb-2 whitespace-pre-wrap line-clamp-3">
                          {prop.draft.content}
                        </p>
                      )}
                      {prop.draft.project_id && (
                        <div className="flex text-[10px] text-gray-400">
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                            <BriefcaseIcon className="w-3 h-3 text-purple-400" />
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
