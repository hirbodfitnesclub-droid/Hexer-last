import React from 'react';
import { XIcon } from './icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md p-6"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-[var(--text-main)]">{title}</h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;