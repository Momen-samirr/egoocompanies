"use client";

import { useState } from "react";
import Image from "next/image";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface DocumentViewerProps {
  selfiePhoto?: string;
  driversLicensePhoto?: string;
  criminalRecordPhoto?: string;
  documentsVerified?: boolean;
  documentsVerifiedAt?: string;
}

export default function DocumentViewer({
  selfiePhoto,
  driversLicensePhoto,
  criminalRecordPhoto,
  documentsVerified,
  documentsVerifiedAt,
}: DocumentViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");

  const documents = [
    {
      title: "Selfie Photo",
      url: selfiePhoto,
      type: "selfie",
    },
    {
      title: "Driver's License",
      url: driversLicensePhoto,
      type: "license",
    },
    {
      title: "Criminal Record (Fish & Tashbih)",
      url: criminalRecordPhoto,
      type: "criminal_record",
    },
  ];

  const openImage = (url: string, title: string) => {
    setSelectedImage(url);
    setSelectedTitle(title);
  };

  const closeImage = () => {
    setSelectedImage(null);
    setSelectedTitle("");
  };

  const uploadedCount = documents.filter((doc) => doc.url).length;

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
              {uploadedCount} of {documents.length} uploaded
            </span>
          </div>
        </div>

        {documentsVerifiedAt && (
          <div className="text-sm text-gray-600">
            Verified on: {new Date(documentsVerifiedAt).toLocaleDateString()}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.type}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-900">
                  {doc.title}
                </h4>
              </div>
              <div className="relative aspect-video bg-gray-100">
                {doc.url ? (
                  <div
                    className="relative w-full h-full cursor-pointer group"
                    onClick={() => openImage(doc.url!, doc.title)}
                  >
                    <Image
                      src={doc.url}
                      alt={doc.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
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
                      <p className="mt-2 text-sm text-gray-500">Not uploaded</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
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
              <div className="relative w-full h-[70vh]">
                <Image
                  src={selectedImage}
                  alt={selectedTitle}
                  fill
                  className="object-contain"
                />
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
    </>
  );
}
