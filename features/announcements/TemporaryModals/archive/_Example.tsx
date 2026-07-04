import React from 'react';
import Modal from '../../../components/Modal';
import { SparklesIcon } from '../../../components/icons';
import { AnnouncementMeta } from '../types';

export const meta: AnnouncementMeta = {
  id: 'example-welcome-modal',
  title: 'به هکسر خوش آمدید',
  priority: 1,
  version: 1
};

interface _ExampleProps {
  isOpen: boolean;
  onClose: () => void;
}

const _Example: React.FC<_ExampleProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={meta.title}>
      <div dir="rtl" className="space-y-4 text-center py-2 text-right">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
          <SparklesIcon className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          این یک مودال اطلاعیه نمونه در سیستم هکسر است که برای اعلام ویژگی‌های جدید استفاده می‌شود.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-primary hover:bg-primary-hover active:bg-primary/80 text-on-primary font-semibold text-xs rounded-xl transition-all"
        >
          فهمیدم، متشکرم!
        </button>
      </div>
    </Modal>
  );
};

export default _Example;
