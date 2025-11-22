"use client";

import { useState } from "react";
import { UseFormRegisterReturn, FieldError } from "react-hook-form";
import LocationAutocomplete from "./LocationAutocomplete";
import MapPicker from "./MapPicker";
import { LocationData } from "@/types/trip";
import { MapIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface LocationPickerProps {
  value?: LocationData;
  onChange: (location: LocationData | null) => void;
  onError?: (error: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: FieldError;
  disabled?: boolean;
  showMapButton?: boolean;
  mapCenter?: { lat: number; lng: number };
  className?: string;
}

export default function LocationPicker({
  value,
  onChange,
  onError,
  label,
  placeholder,
  required = false,
  error,
  disabled = false,
  showMapButton = true,
  mapCenter,
  className = "",
}: LocationPickerProps) {
  const [showMapModal, setShowMapModal] = useState(false);
  const [internalError, setInternalError] = useState<string>("");

  const handleLocationChange = (location: LocationData | null) => {
    setInternalError("");
    onChange(location);
  };

  const handleError = (errorMessage: string) => {
    setInternalError(errorMessage);
    onError?.(errorMessage);
  };

  const handleMapSelect = (location: LocationData | null) => {
    handleLocationChange(location);
    if (location) {
      setShowMapModal(false);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {label && (
            <label className="block text-sm font-medium text-gray-700">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
          {showMapButton && (
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MapIcon className="h-4 w-4" />
              Pick on Map
            </button>
          )}
        </div>

        <LocationAutocomplete
          value={value}
          onChange={handleLocationChange}
          onError={handleError}
          placeholder={placeholder}
          required={required}
          error={error?.message || internalError}
          disabled={disabled}
        />

        {error && !internalError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <span>⚠</span>
            <span>{error.message}</span>
          </p>
        )}
      </div>

      {/* Map Picker Modal */}
      <Transition show={showMapModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowMapModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-xl bg-white shadow-xl transition-all">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Select Location on Map
                      </Dialog.Title>
                      <button
                        type="button"
                        onClick={() => setShowMapModal(false)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <span className="text-2xl leading-none">×</span>
                      </button>
                    </div>

                    <MapPicker
                      value={value}
                      onChange={handleMapSelect}
                      onError={handleError}
                      center={mapCenter || value ? { lat: value!.latitude, lng: value!.longitude } : undefined}
                      height="500px"
                      disabled={disabled}
                    />

                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowMapModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      {value && (
                        <button
                          type="button"
                          onClick={() => setShowMapModal(false)}
                          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Confirm Selection
                        </button>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

// React Hook Form wrapper component
interface LocationPickerFieldProps extends Omit<LocationPickerProps, "value" | "onChange" | "error"> {
  register?: UseFormRegisterReturn;
  value?: LocationData;
  onChange?: (location: LocationData | null) => void;
  error?: FieldError;
}

export function LocationPickerField({
  register,
  value,
  onChange,
  error,
  ...props
}: LocationPickerFieldProps) {
  const handleChange = (location: LocationData | null) => {
    // Update the hidden input for form submission
    if (register) {
      const event = {
        target: {
          name: register.name,
          value: location
            ? JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
              })
            : "",
        },
      } as any;
      register.onChange(event);
    }
    onChange?.(location);
  };

  return (
    <div>
      <LocationPicker
        value={value}
        onChange={handleChange}
        error={error}
        {...props}
      />
      {register && (
        <input
          type="hidden"
          {...register}
          value={
            value
              ? JSON.stringify({
                  latitude: value.latitude,
                  longitude: value.longitude,
                })
              : ""
          }
        />
      )}
    </div>
  );
}

