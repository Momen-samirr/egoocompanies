"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ScheduledTrip } from "@/types/trip";
import { Company } from "@/types";
import api from "@/lib/api";
import CaptainSelector from "@/components/trips/CaptainSelector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface MultiEditModalProps {
  selectedTripIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onShowChanges: (changes: TripChanges) => void;
  onSaveSuccess?: () => void;
}

interface TripEditData {
  name: string;
  tripDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  companyId: string;
  assignedCaptainId: string;
  price: number;
}

export interface TripChange {
  tripId: string;
  tripName: string;
  fields: {
    [key: string]: {
      before: any;
      after: any;
      beforeId?: string;
      afterId?: string;
    };
  };
}

export interface TripChanges {
  [tripId: string]: TripChange;
}

export default function MultiEditModal({
  selectedTripIds,
  isOpen,
  onClose,
  onShowChanges,
  onSaveSuccess,
}: MultiEditModalProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [trips, setTrips] = useState<ScheduledTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const initializedTripIds = useRef<string>("");
  
  // Store original trip data
  const [originalData, setOriginalData] = useState<Map<string, TripEditData>>(
    new Map()
  );

  // Store current edited data
  const [editedData, setEditedData] = useState<Map<string, TripEditData>>(
    new Map()
  );

  // Fetch trips when modal opens
  useEffect(() => {
    if (isOpen && selectedTripIds.length > 0) {
      const tripIds = [...selectedTripIds].sort().join(",");
      
      // Only re-fetch if trip IDs actually changed
      if (tripIds !== initializedTripIds.current) {
        setLoading(true);
        setFetchError(null);
        
        // Fetch all selected trips in parallel
        Promise.all(
          selectedTripIds.map((tripId) =>
            api.get(`/admin/trips/${tripId}`).then((res) => res.data.trip)
          )
        )
          .then((fetchedTrips) => {
            // Filter out any null/undefined results (deleted trips)
            const validTrips = fetchedTrips.filter(
              (trip): trip is ScheduledTrip => trip !== null && trip !== undefined
            );
            
            if (validTrips.length === 0) {
              setFetchError("No trips could be loaded. They may have been deleted.");
              setTrips([]);
              setLoading(false);
              return;
            }

            setTrips(validTrips);

            // Initialize maps with fetched trip data
            const originalMap = new Map<string, TripEditData>();
            const editedMap = new Map<string, TripEditData>();

            validTrips.forEach((trip) => {
              const tripData: TripEditData = {
                name: trip.name || "",
                tripDate: trip.tripDate?.split("T")[0] || new Date().toISOString().split("T")[0],
                scheduledTime: trip.scheduledTime
                  ? new Date(trip.scheduledTime).toTimeString().slice(0, 5)
                  : "00:00",
                companyId: trip.companyId || "",
                assignedCaptainId: trip.assignedCaptainId || "",
                price: trip.price || 0,
              };
              originalMap.set(trip.id, tripData);
              editedMap.set(trip.id, { ...tripData });
            });

            setOriginalData(originalMap);
            setEditedData(editedMap);
            initializedTripIds.current = tripIds;
            setLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching trips:", error);
            setFetchError(
              error.response?.data?.message ||
                "Failed to load trips. Please try again."
            );
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
      
      // Fetch companies if not already loaded
      if (companies.length === 0) {
        fetchCompanies();
      }
    } else if (!isOpen) {
      // Reset when modal closes
      initializedTripIds.current = "";
      setOriginalData(new Map());
      setEditedData(new Map());
      setTrips([]);
      setFetchError(null);
      setLoading(true);
    }
  }, [isOpen, selectedTripIds, companies.length]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get("/admin/companies");
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTripField = (
    tripId: string,
    field: keyof TripEditData,
    value: any
  ) => {
    setEditedData((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(tripId) || originalData.get(tripId)!;
      newMap.set(tripId, {
        ...current,
        [field]: value,
      });
      return newMap;
    });
  };

  const getTripData = (tripId: string): TripEditData => {
    const edited = editedData.get(tripId);
    if (edited) return edited;
    
    const original = originalData.get(tripId);
    if (original) return original;
    
    // Fallback: find the trip in the trips prop and create default data
    const trip = trips.find((t) => t.id === tripId);
    if (trip) {
      return {
        name: trip.name,
        tripDate: trip.tripDate.split("T")[0],
        scheduledTime: new Date(trip.scheduledTime).toTimeString().slice(0, 5),
        companyId: trip.companyId || "",
        assignedCaptainId: trip.assignedCaptainId || "",
        price: trip.price || 0,
      };
    }
    
    // Ultimate fallback (should never happen)
    return {
      name: "",
      tripDate: new Date().toISOString().split("T")[0],
      scheduledTime: "00:00",
      companyId: "",
      assignedCaptainId: "",
      price: 0,
    };
  };

  const hasChanges = (tripId: string): boolean => {
    const original = originalData.get(tripId);
    const edited = editedData.get(tripId);
    if (!original || !edited) return false;

    return (
      original.name !== edited.name ||
      original.tripDate !== edited.tripDate ||
      original.scheduledTime !== edited.scheduledTime ||
      original.companyId !== edited.companyId ||
      original.assignedCaptainId !== edited.assignedCaptainId ||
      original.price !== edited.price
    );
  };

  const hasAnyChanges = (): boolean => {
    return trips.some((trip) => hasChanges(trip.id));
  };

  const getChanges = (): TripChanges => {
    const changes: TripChanges = {};

    trips.forEach((trip) => {
      if (!hasChanges(trip.id)) return;

      const original = originalData.get(trip.id)!;
      const edited = editedData.get(trip.id)!;
      const fieldChanges: TripChange["fields"] = {};

      if (original.name !== edited.name) {
        fieldChanges.name = { before: original.name, after: edited.name };
      }
      if (original.tripDate !== edited.tripDate) {
        fieldChanges.tripDate = { before: original.tripDate, after: edited.tripDate };
      }
      if (original.scheduledTime !== edited.scheduledTime) {
        fieldChanges.scheduledTime = {
          before: original.scheduledTime,
          after: edited.scheduledTime,
        };
      }
      if (original.companyId !== edited.companyId) {
        const beforeCompany = companies.find((c) => c.id === original.companyId);
        const afterCompany = companies.find((c) => c.id === edited.companyId);
        fieldChanges.companyId = {
          before: beforeCompany?.name || original.companyId || "None",
          after: afterCompany?.name || edited.companyId || "None",
          beforeId: original.companyId || "",
          afterId: edited.companyId || "",
        };
      }
      if (original.assignedCaptainId !== edited.assignedCaptainId) {
        const originalTrip = trips.find((t) => t.id === trip.id);
        const beforeCaptain = originalTrip?.assignedCaptain?.name || original.assignedCaptainId || "None";
        // For "after", we'll try to get the name, but if not available, show ID or "None"
        const afterCaptain = edited.assignedCaptainId || "None";
        fieldChanges.assignedCaptainId = {
          before: beforeCaptain,
          after: afterCaptain,
          beforeId: original.assignedCaptainId || "",
          afterId: edited.assignedCaptainId || "",
        };
      }
      if (original.price !== edited.price) {
        fieldChanges.price = { before: original.price, after: edited.price };
      }

      changes[trip.id] = {
        tripId: trip.id,
        tripName: edited.name,
        fields: fieldChanges,
      };
    });

    return changes;
  };

  const handleShowChanges = () => {
    const changes = getChanges();
    onShowChanges(changes);
  };

  const handleCancel = () => {
    // Reset to original data
    setEditedData(new Map(originalData));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Edit {selectedTripIds.length} Trip{selectedTripIds.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? "Loading trips..."
                : fetchError
                ? fetchError
                : "Make changes to the trips below. Modified rows are highlighted."}
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-500"
            disabled={loading}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-sm text-gray-600">Loading trips...</p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-red-600 mb-4">{fetchError}</p>
                <Button variant="outline" onClick={handleCancel}>
                  Close
                </Button>
              </div>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">No trips to edit</p>
                <Button variant="outline" onClick={handleCancel}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => {
                  const data = getTripData(trip.id);
                  const changed = hasChanges(trip.id);
                  const canEdit =
                    trip.status === "SCHEDULED" ||
                    trip.status === "FAILED" ||
                    trip.status === "ACTIVE";

                  return (
                    <TableRow
                      key={trip.id}
                      className={cn(
                        changed && "bg-indigo-50/50",
                        !canEdit && "opacity-60"
                      )}
                    >
                      <TableCell>
                        <input
                          type="text"
                          value={data.name}
                          onChange={(e) =>
                            updateTripField(trip.id, "name", e.target.value)
                          }
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="date"
                          value={data.tripDate}
                          onChange={(e) =>
                            updateTripField(trip.id, "tripDate", e.target.value)
                          }
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="time"
                          value={data.scheduledTime}
                          onChange={(e) =>
                            updateTripField(
                              trip.id,
                              "scheduledTime",
                              e.target.value
                            )
                          }
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={data.companyId}
                          onChange={(e) =>
                            updateTripField(trip.id, "companyId", e.target.value)
                          }
                          disabled={!canEdit || loading}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select company</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[200px]">
                          <CaptainSelector
                            value={data.assignedCaptainId || undefined}
                            onChange={(captainId) =>
                              updateTripField(
                                trip.id,
                                "assignedCaptainId",
                                captainId || ""
                              )
                            }
                            disabled={!canEdit}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={data.price}
                          onChange={(e) =>
                            updateTripField(
                              trip.id,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={!canEdit}
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!loading && !fetchError && trips.length > 0 && (
          <div className="flex gap-3 justify-between items-center p-6 border-t border-gray-200 sticky bottom-0 bg-white">
            <div className="text-sm text-gray-600">
              {hasAnyChanges()
                ? `${trips.filter((t) => hasChanges(t.id)).length} trip${trips.filter((t) => hasChanges(t.id)).length !== 1 ? "s" : ""} with changes`
                : "No changes made"}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleShowChanges}
                disabled={!hasAnyChanges()}
              >
                Show Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

