"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import Button from "@/components/common/Button";

interface DocumentInfo {
  url?: string;
  uploaded: boolean;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectedAt?: string;
}

interface DocumentViewerProps {
  driverId: string;
  selfiePhoto?: string;
  driversLicensePhoto?: string;
  driversLicensePhotos?: Array<{ side: "front" | "back"; url: string }>;
  criminalRecordPhoto?: string;
  drugTestPhoto?: string;
  documentStatuses?: {
    [key: string]: {
      status: "pending" | "approved" | "rejected";
      reviewedBy?: string;
      reviewedAt?: string;
      rejectionReason?: string;
      rejectedAt?: string;
    };
  };
  documentsVerified?: boolean;
  documentsVerifiedAt?: string;
}

export default function DocumentViewer({
  driverId,
  selfiePhoto,
  driversLicensePhoto,
  driversLicensePhotos,
  criminalRecordPhoto,
  drugTestPhoto,
  documentStatuses,
  documentsVerified,
  documentsVerifiedAt,
}: DocumentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean;
    documentType: string;
    rejectionReason: string;
  }>({ open: false, documentType: "", rejectionReason: "" });
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [documents, setDocuments] = useState<{
    [key: string]: DocumentInfo;
  }>({});

  useEffect(() => {
    // Initialize documents from props
    const licensePhotos = Array.isArray(driversLicensePhotos)
      ? driversLicensePhotos
      : [];
    const licenseFront = licensePhotos.find((p) => p?.side === "front");
    const licenseBack = licensePhotos.find((p) => p?.side === "back");

    const statuses =
      documentStatuses && typeof documentStatuses === "object"
        ? documentStatuses
        : {};

    setDocuments({
      selfie: {
        url: selfiePhoto || undefined,
        uploaded: !!selfiePhoto,
        status:
          statuses.selfie?.status || (selfiePhoto ? "pending" : undefined),
        rejectionReason: statuses.selfie?.rejectionReason || undefined,
        reviewedAt: statuses.selfie?.reviewedAt || undefined,
      },
      licenseFront: {
        url: licenseFront?.url || driversLicensePhoto || undefined,
        uploaded: !!(licenseFront?.url || driversLicensePhoto),
        status:
          statuses.licenseFront?.status ||
          (licenseFront?.url || driversLicensePhoto ? "pending" : undefined),
        rejectionReason: statuses.licenseFront?.rejectionReason || undefined,
        reviewedAt: statuses.licenseFront?.reviewedAt || undefined,
      },
      licenseBack: {
        url: licenseBack?.url || undefined,
        uploaded: !!licenseBack?.url,
        status:
          statuses.licenseBack?.status ||
          (licenseBack?.url ? "pending" : undefined),
        rejectionReason: statuses.licenseBack?.rejectionReason || undefined,
        reviewedAt: statuses.licenseBack?.reviewedAt || undefined,
      },
      criminalRecord: {
        url: criminalRecordPhoto || undefined,
        uploaded: !!criminalRecordPhoto,
        status:
          statuses.criminalRecord?.status ||
          (criminalRecordPhoto ? "pending" : undefined),
        rejectionReason: statuses.criminalRecord?.rejectionReason || undefined,
        reviewedAt: statuses.criminalRecord?.reviewedAt || undefined,
      },
      drugTest: {
        url: drugTestPhoto || undefined,
        uploaded: !!drugTestPhoto,
        status:
          statuses.drugTest?.status || (drugTestPhoto ? "pending" : undefined),
        rejectionReason: statuses.drugTest?.rejectionReason || undefined,
        reviewedAt: statuses.drugTest?.reviewedAt || undefined,
      },
    });
  }, [
    selfiePhoto,
    driversLicensePhoto,
    driversLicensePhotos,
    criminalRecordPhoto,
    drugTestPhoto,
    documentStatuses,
  ]);

  const openImage = (url: string, title: string) => {
    setSelectedImage(url);
    setSelectedTitle(title);
  };

  const closeImage = () => {
    setSelectedImage(null);
    setSelectedTitle("");
  };

  const handleApprove = async (documentType: string) => {
    try {
      setLoading((prev) => ({ ...prev, [documentType]: true }));
      await api.post(`/admin/drivers/${driverId}/documents/review`, {
        documentType,
        action: "approve",
      });

      // Update local state
      setDocuments((prev) => ({
        ...prev,
        [documentType]: {
          ...prev[documentType],
          status: "approved",
          rejectionReason: undefined,
        },
      }));

      alert("Document approved successfully!");
      // Reload page data
      window.location.reload();
    } catch (error: any) {
      console.error("Error approving document:", error);
      alert(error.response?.data?.message || "Failed to approve document");
    } finally {
      setLoading((prev) => ({ ...prev, [documentType]: false }));
    }
  };

  const handleReject = async () => {
    if (!rejectionModal.rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    try {
      setLoading((prev) => ({
        ...prev,
        [rejectionModal.documentType]: true,
      }));
      await api.post(`/admin/drivers/${driverId}/documents/review`, {
        documentType: rejectionModal.documentType,
        action: "reject",
        rejectionReason: rejectionModal.rejectionReason,
      });

      // Update local state
      setDocuments((prev) => ({
        ...prev,
        [rejectionModal.documentType]: {
          ...prev[rejectionModal.documentType],
          status: "rejected",
          rejectionReason: rejectionModal.rejectionReason,
        },
      }));

      setRejectionModal({ open: false, documentType: "", rejectionReason: "" });
      alert("Document rejected successfully!");
      // Reload page data
      window.location.reload();
    } catch (error: any) {
      console.error("Error rejecting document:", error);
      alert(error.response?.data?.message || "Failed to reject document");
    } finally {
      setLoading((prev) => ({
        ...prev,
        [rejectionModal.documentType]: false,
      }));
    }
  };

  const openRejectionModal = (documentType: string) => {
    setRejectionModal({
      open: true,
      documentType,
      rejectionReason: "",
    });
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const badges = {
      approved: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Approved
        </span>
      ),
      rejected: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Rejected
        </span>
      ),
      pending: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Pending Review
        </span>
      ),
    };

    return badges[status as keyof typeof badges] || null;
  };

  const documentList = [
    {
      key: "selfie",
      title: "Selfie Photo",
      document: documents.selfie || {
        url: undefined,
        uploaded: false,
        status: undefined,
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
    },
    {
      key: "licenseFront",
      title: "Driver's License - Front",
      document: documents.licenseFront || {
        url: undefined,
        uploaded: false,
        status: undefined,
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
    },
    {
      key: "licenseBack",
      title: "Driver's License - Back",
      document: documents.licenseBack || {
        url: undefined,
        uploaded: false,
        status: undefined,
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
    },
    {
      key: "criminalRecord",
      title: "Criminal Record (Fish & Tashbih)",
      document: documents.criminalRecord || {
        url: undefined,
        uploaded: false,
        status: undefined,
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
    },
    {
      key: "drugTest",
      title: "Drug Test Document",
      document: documents.drugTest || {
        url: undefined,
        uploaded: false,
        status: undefined,
        rejectionReason: undefined,
        reviewedAt: undefined,
      },
    },
  ];

  const uploadedCount = documentList.filter(
    (doc) => doc.document?.uploaded
  ).length;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <div className="flex items-center gap-2">
            {documentsVerified ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Verified
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Pending Verification
              </span>
            )}
            <span className="text-sm text-gray-500">
              {uploadedCount} of {documentList.length} uploaded
            </span>
          </div>
        </div>

        {documentsVerifiedAt && (
          <div className="text-sm text-gray-600">
            Verified on: {new Date(documentsVerifiedAt).toLocaleDateString()}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documentList.map((doc) => {
            const document = doc.document || {
              url: undefined,
              uploaded: false,
              status: undefined,
              rejectionReason: undefined,
              reviewedAt: undefined,
            };
            return (
              <div
                key={doc.key}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {doc.title}
                    </h4>
                    {getStatusBadge(document.status)}
                  </div>
                  {document.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      <strong>Rejection Reason:</strong>{" "}
                      {document.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="relative aspect-video bg-gray-100">
                  {document.url ? (
                    <div
                      className="relative w-full h-full cursor-pointer group overflow-hidden"
                      onClick={() => openImage(document.url!, doc.title)}
                    >
                      <img
                        src={document.url}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("Image load error:", document.url);
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const errorDiv = window.document.createElement("div");
                          errorDiv.className =
                            "absolute inset-0 flex items-center justify-center bg-red-50";
                          errorDiv.innerHTML = `
                            <div class="text-center p-4">
                              <svg class="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <p class="text-xs text-red-600">Image failed to load</p>
                            </div>
                          `;
                          target.parentElement?.appendChild(errorDiv);
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100">
                          Click to view
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-500">
                          Not uploaded
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {document.uploaded && document.status !== "approved" && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(doc.key)}
                      disabled={loading[doc.key]}
                    >
                      {loading[doc.key] ? "..." : "Approve"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openRejectionModal(doc.key)}
                      disabled={loading[doc.key]}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full-size image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={closeImage}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
            <button
              onClick={closeImage}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-8 w-8" />
            </button>
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedTitle}
                </h3>
              </div>
              <div className="relative w-full h-[70vh] bg-gray-100">
                {selectedImage && (
                  <img
                    src={selectedImage}
                    alt={selectedTitle}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error(
                        "Image load error in modal:",
                        selectedImage
                      );
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const errorDiv = document.createElement("div");
                      errorDiv.className =
                        "absolute inset-0 flex items-center justify-center bg-gray-100";
                      errorDiv.innerHTML = `
                        <div class="text-center">
                          <svg class="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p class="text-sm text-gray-600">Failed to load image</p>
                          <a href="${selectedImage}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
                            Open in new tab
                          </a>
                        </div>
                      `;
                      target.parentElement?.appendChild(errorDiv);
                    }}
                  />
                )}
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <a
                  href={selectedImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open in new tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Document
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this document:
            </p>
            <textarea
              value={rejectionModal.rejectionReason}
              onChange={(e) =>
                setRejectionModal((prev) => ({
                  ...prev,
                  rejectionReason: e.target.value,
                }))
              }
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter rejection reason..."
            />
            <div className="flex gap-3 mt-4">
              <Button
                variant="primary"
                onClick={handleReject}
                disabled={loading[rejectionModal.documentType]}
              >
                {loading[rejectionModal.documentType]
                  ? "..."
                  : "Confirm Reject"}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setRejectionModal({
                    open: false,
                    documentType: "",
                    rejectionReason: "",
                  })
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
