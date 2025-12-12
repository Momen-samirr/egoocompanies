"use client";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import type { AdminNotification } from "@/types";
import { DocumentTextIcon, ClockIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface NotificationItemProps {
  notification: AdminNotification;
  onClose?: () => void;
}

const documentTypeLabels: Record<string, string> = {
  selfie: "Selfie",
  license_front: "License Front",
  license_back: "License Back",
  drug_test: "Drug Test",
  criminal_record: "Criminal Record",
};

export default function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const { markAsRead } = useNotifications();

  const handleClick = () => {
    if (notification.status === "UNREAD") {
      markAsRead(notification.id);
    }
    router.push(`/dashboard/drivers/${notification.driverId}`);
    onClose?.();
  };

  const documentLabel =
    documentTypeLabels[notification.documentType] || notification.documentType;
  const action =
    notification.type === "DOCUMENT_UPDATE" ? "updated" : "uploaded";

  return (
    <div
      onClick={handleClick}
      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
        notification.status === "UNREAD" ? "bg-indigo-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {notification.driver.name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {action} {documentLabel}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <ClockIcon className="h-3 w-3" />
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
            {notification.status === "UNREAD" && (
              <div className="h-2 w-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
