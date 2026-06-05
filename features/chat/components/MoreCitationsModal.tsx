import React, { useState } from 'react';
import { Citation } from '../../../types';
import { XIcon, ListChecksIcon, NotebookIcon, ChevronLeftIcon, ChevronRightIcon, LinkIcon, BriefcaseIcon } from '../../../components/icons';

interface MoreCitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
}

export const MoreCitationsModal: React.FC<MoreCitationsModalProps> = ({
  isOpen,
  onClose,
  citations,
  onCitationClick
}) => {
  const [activeTab, setActiveTab] = useState<'task' | 'note' | 'project'>('task');
  const [taskPage, setTaskPage] = useState(1);
  const [notePage, setNotePage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);

  if (!isOpen) return null;

  // Filter citations based on model types
  const taskCitations = citations.filter((c) => c.type === 'task');
  const noteCitations = citations.filter((c) => c.type === 'note');
  const projectCitations = citations.filter((c) => c.type === 'project');

  const pageSize = 5;

  // Determine pagination variables based on active tab
  const getTabItems = () => {
    if (activeTab === 'task') return taskCitations;
    if (activeTab === 'note') return noteCitations;
    return projectCitations;
  };

  const getTabPage = () => {
    if (activeTab === 'task') return taskPage;
    if (activeTab === 'note') return notePage;
    return projectPage;
  };

  const setTabPage = (value: number | ((prev: number) => number)) => {
    if (activeTab === 'task') {
      setTaskPage(value);
    } else if (activeTab === 'note') {
      setNotePage(value);
    } else {
      setProjectPage(value);
    }
  };

  const currentItems = getTabItems();
  const currentPage = getTabPage();
  const setCurrentPage = setTabPage;

  const totalPages = Math.max(1, Math.ceil(currentItems.length / pageSize));
  
  // Safe page index calculation
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedItems = currentItems.slice(startIndex, startIndex + pageSize);

  const formatSimilarity = (val?: number) => {
    if (val === undefined || val === null) return 'N/A';
    // Score might be reciprocal rank fusion score or similarity score
    const percent = Math.min(100, Math.round(val * 100));
    return `${percent}٪`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      id="more-citations-backdrop"
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden sm:p-5 p-4 text-right"
        onClick={(e) => e.stopPropagation()}
        id="more-citations-modal-content"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-sky-400" />
            نتایج و مراجع مشابه ترانزیت شده
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            id="close-more-citations-modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-white/5 mb-4 gap-2">
          <button
            onClick={() => setActiveTab('task')}
            className={`flex-1 pb-3 text-[11px] sm:text-xs font-semibold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'task'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            id="tab-task"
          >
            <ListChecksIcon className="w-3.5 h-3.5" />
            کارهای مرتبط ({taskCitations.length})
          </button>
          <button
            onClick={() => setActiveTab('note')}
            className={`flex-1 pb-3 text-[11px] sm:text-xs font-semibold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'note'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            id="tab-note"
          >
            <NotebookIcon className="w-3.5 h-3.5" />
            یادداشت‌های مرتبط ({noteCitations.length})
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 pb-3 text-[11px] sm:text-xs font-semibold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'project'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
            id="tab-project"
          >
            <BriefcaseIcon className="w-3.5 h-3.5" />
            پروژه‌های مرتبط ({projectCitations.length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[250px] pr-1">
          {paginatedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              مورد مرتبطی یافت نشد.
            </div>
          ) : (
            paginatedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onCitationClick(item);
                  onClose();
                }}
                className="bg-gray-800/30 hover:bg-gray-800/80 border border-white/5 hover:border-sky-500/30 p-3.5 rounded-xl transition-all cursor-pointer group flex flex-col gap-2"
                id={`citation-item-${item.id}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-1 flex-1">
                    {item.title}
                  </h3>
                  {item.similarity !== undefined && (
                    <span className="text-[10px] px-2 py-0.5 bg-sky-500/10 text-sky-400 font-mono rounded">
                      شباهت: {formatSimilarity(item.similarity)}
                    </span>
                  )}
                </div>
                {item.snippet && (
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed bg-black/20 p-2 rounded border border-white/5">
                    {item.snippet}
                  </p>
                )}
                <div className="flex justify-end text-[10px] text-gray-500 items-center gap-1">
                  <span>مشاهده جزئیات</span>
                  <LinkIcon className="w-3 h-3 group-hover:translate-x-[-2px] transition-transform" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-4 text-xs select-none">
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 bg-gray-800 border border-white/5 hover:border-sky-500/20 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
              id="pg-prev-btn"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span>صفحه بعدی</span>
            </button>

            <span className="text-gray-400 font-semibold font-mono">
              صفحه {currentPage} از {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 bg-gray-800 border border-white/5 hover:border-sky-500/20 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
              id="pg-next-btn"
            >
              <span>صفحه قبلی</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
