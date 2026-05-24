import React from 'react';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel }: {
  open: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded shadow-lg max-w-lg w-full p-4">
        <div className="font-semibold text-lg">{title || 'Confirm'}</div>
        <div className="mt-2 text-sm text-gray-700">{message}</div>
        <div className="mt-4 flex justify-end space-x-2">
          <button onClick={onCancel} className="px-3 py-1 border rounded">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1 bg-primary text-white rounded">Confirm</button>
        </div>
      </div>
    </div>
  );
}
