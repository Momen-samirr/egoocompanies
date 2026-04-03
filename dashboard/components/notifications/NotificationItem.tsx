"use client";

import {
  AdminNotification,
  NotificationType,
  NotificationStatus,
} from "@/types";
import { formatDistanceToNow } from "date-fns";
import { DocumentIcon, ClockIcon } from "@heroicons/react/24/outline";

interface NotificationItemProps {
  notification: AdminNotification;
  onClick?: () => void;
}

const getDocumentTypeLabel = (documentType: string): string => {
  const labels: Record<string, string> = {
    selfie: "Selfie",
    license_front: "License (Front)",
    license_back: "License (Back)",
    license: "License",
    criminal_record: "Criminal Record",
    drug_test: "Drug Test",
  };
  return (
    labels[documentType] ||
    documentType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

const getActionLabel = (type: NotificationType): string => {
  return type === NotificationType.DOCUMENT_UPDATE ? "updated" : "uploaded";
};

export default function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const isUnread = notification.status === NotificationStatus.UNREAD;
  const driverName =
    notification.driver?.name || `Driver ${notification.driverId.slice(-6)}`;
  const documentTypeLabel = getDocumentTypeLabel(notification.documentType);
  const actionLabel = getActionLabel(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-xl cursor-pointer transition-colors hover:bg-slate-100 ${
        isUnread ? "bg-indigo-50" : "bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 mt-1 ${
            isUnread ? "text-indigo-600" : "text-gray-400"
          }`}
        >
          <DocumentIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{driverName}</p>
              <p className="text-sm text-gray-600 mt-1">
                {actionLabel} {documentTypeLabel}
              </p>
            </div>
            {isUnread && (
              <span className="shrink-0 h-2 w-2 rounded-full bg-indigo-500 mt-2" />
            )}
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <ClockIcon className="h-3.5 w-3.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
