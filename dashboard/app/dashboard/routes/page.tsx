"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FormField from "@/components/common/FormField";
import LocationPicker from "@/components/trips/LocationPicker";
import {
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  MapPinIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { LocationData } from "@/types/trip";

interface School {
  id: string;
  name: string;
}

interface Route {
  id: string;
  name: string;
  description?: string;
  schoolId: string;
  school: {
    id: string;
    name: string;
  };
  _count?: {
    stops: number;
    trips: number;
  };
}

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
  routeId: string;
  _count?: {
    students: number;
  };
}

interface RouteFormState {
  schoolId: string;
  name: string;
  description: string;
}

interface StopFormState {
  name: string;
  latitude: string;
  longitude: string;
  order: string;
}

export default function RoutesPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [routeFormState, setRouteFormState] = useState<RouteFormState>({
    schoolId: "",
    name: "",
    description: "",
  });
  const [stopFormState, setStopFormState] = useState<StopFormState>({
    name: "",
    latitude: "",
    longitude: "",
    order: "",
  });
  const [stopLocation, setStopLocation] = useState<LocationData | null>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response
        ?.data?.message === "string"
    ) {
      return (
        (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message || fallback
      );
    }
    return fallback;
  };

  const fetchSchools = useCallback(async () => {
    try {
      const response = await api.get("/admin/schools");
      const schoolsData = response.data.schools || [];
      setSchools(schoolsData);
      // Set default school only if form doesn't have one yet
      setRouteFormState((prev) => {
        if (!prev.schoolId && schoolsData.length > 0) {
          return { ...prev, schoolId: schoolsData[0].id };
        }
        return prev;
      });
    } catch (error) {
      console.error("Error fetching schools:", error);
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/routes");
      setRoutes(response.data.routes || []);
    } catch (error) {
      console.error("Error fetching routes:", error);
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to load routes"
          : "Failed to load routes";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStops = useCallback(async (routeId: string) => {
    try {
      const response = await api.get("/admin/stops", {
        params: { routeId },
      });
      setStops(response.data.stops || []);
    } catch (error) {
      console.error("Error fetching stops:", error);
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to load stops"
          : "Failed to load stops";
      toast.error(errorMessage);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
    fetchRoutes();
  }, [fetchSchools, fetchRoutes]);

  useEffect(() => {
    if (selectedRoute) {
      fetchStops(selectedRoute.id);
    } else {
      setStops([]);
    }
  }, [selectedRoute, fetchStops]);

  const resetRouteForm = () => {
    setEditingRoute(null);
    setRouteFormState({
      schoolId: schools[0]?.id || "",
      name: "",
      description: "",
    });
  };

  const resetStopForm = () => {
    setEditingStop(null);
    setStopFormState({
      name: "",
      latitude: "",
      longitude: "",
      order: "",
    });
    setStopLocation(null);
  };

  const handleRouteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!routeFormState.schoolId || !routeFormState.name) {
      toast.error("School and route name are required");
      return;
    }

    try {
      setSaving(true);
      if (editingRoute) {
        await api.put(`/admin/routes/${editingRoute.id}`, {
          name: routeFormState.name,
          description: routeFormState.description || null,
        });
        toast.success("Route updated");
      } else {
        await api.post("/admin/routes", {
          schoolId: routeFormState.schoolId,
          name: routeFormState.name,
          description: routeFormState.description || null,
        });
        toast.success("Route created");
      }
      resetRouteForm();
      fetchRoutes();
    } catch (error) {
      console.error("Error saving route:", error);
      toast.error(getErrorMessage(error, "Failed to save route"));
    } finally {
      setSaving(false);
    }
  };

  const handleRouteEdit = (route: Route) => {
    setEditingRoute(route);
    setRouteFormState({
      schoolId: route.schoolId,
      name: route.name,
      description: route.description || "",
    });
  };

  const handleRouteDelete = async (route: Route) => {
    if (!confirm(`Delete route "${route.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/routes/${route.id}`);
      toast.success("Route deleted");
      if (editingRoute?.id === route.id) {
        resetRouteForm();
      }
      if (selectedRoute?.id === route.id) {
        setSelectedRoute(null);
      }
      fetchRoutes();
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error(getErrorMessage(error, "Failed to delete route"));
    }
  };

  const handleStopSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRoute) {
      toast.error("Please select a route first");
      return;
    }
    if (!stopFormState.name || !stopLocation) {
      toast.error("Stop name and location are required");
      return;
    }

    try {
      setSaving(true);
      if (editingStop) {
        await api.put(`/admin/stops/${editingStop.id}`, {
          name: stopFormState.name,
          latitude: stopLocation.latitude,
          longitude: stopLocation.longitude,
          order: stopFormState.order ? parseInt(stopFormState.order) : undefined,
        });
        toast.success("Stop updated");
      } else {
        await api.post("/admin/stops", {
          routeId: selectedRoute.id,
          name: stopFormState.name,
          latitude: stopLocation.latitude,
          longitude: stopLocation.longitude,
          order: stopFormState.order ? parseInt(stopFormState.order) : undefined,
        });
        toast.success("Stop created");
      }
      resetStopForm();
      if (selectedRoute) {
        fetchStops(selectedRoute.id);
      }
    } catch (error) {
      console.error("Error saving stop:", error);
      toast.error(getErrorMessage(error, "Failed to save stop"));
    } finally {
      setSaving(false);
    }
  };

  const handleStopEdit = (stop: Stop) => {
    setEditingStop(stop);
    setStopFormState({
      name: stop.name,
      latitude: stop.latitude.toString(),
      longitude: stop.longitude.toString(),
      order: stop.order.toString(),
    });
    setStopLocation({
      latitude: stop.latitude,
      longitude: stop.longitude,
      name: stop.name,
    });
  };

  const handleStopDelete = async (stop: Stop) => {
    if (!confirm(`Delete stop "${stop.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/stops/${stop.id}`);
      toast.success("Stop deleted");
      if (editingStop?.id === stop.id) {
        resetStopForm();
      }
      if (selectedRoute) {
        fetchStops(selectedRoute.id);
      }
    } catch (error) {
      console.error("Error deleting stop:", error);
      toast.error(getErrorMessage(error, "Failed to delete stop"));
    }
  };

  const handleStopOrderChange = async (stop: Stop, direction: "up" | "down") => {
    if (!selectedRoute) return;

    const currentIndex = stops.findIndex((s) => s.id === stop.id);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= stops.length) return;

    const targetStop = stops[newIndex];
    const newOrder = targetStop.order;
    const targetNewOrder = stop.order;

    try {
      // Update both stops' orders
      await api.put(`/admin/stops/${stop.id}`, { order: newOrder });
      await api.put(`/admin/stops/${targetStop.id}`, { order: targetNewOrder });
      toast.success("Stop order updated");
      fetchStops(selectedRoute.id);
    } catch (error) {
      console.error("Error updating stop order:", error);
      toast.error(getErrorMessage(error, "Failed to update stop order"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Routes & Stops</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage transportation routes and pickup/dropoff stops
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Route Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingRoute ? "Edit Route" : "Add Route"}
                </h2>
              </div>
              {editingRoute && (
                <button
                  onClick={resetRouteForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRouteSubmit} className="space-y-4">
              <FormField label="School" required>
                <select
                  value={routeFormState.schoolId}
                  onChange={(e) =>
                    setRouteFormState({ ...routeFormState, schoolId: e.target.value })
                  }
                  disabled={!!editingRoute}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white disabled:bg-gray-100"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Route Name" required>
                <input
                  type="text"
                  value={routeFormState.name}
                  onChange={(e) =>
                    setRouteFormState({ ...routeFormState, name: e.target.value })
                  }
                  placeholder="e.g., Route A - Morning"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Description">
                <input
                  type="text"
                  value={routeFormState.description}
                  onChange={(e) =>
                    setRouteFormState({
                      ...routeFormState,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <Button type="submit" disabled={saving} className="w-full">
                {saving
                  ? "Saving..."
                  : editingRoute
                  ? "Update Route"
                  : "Create Route"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Routes List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                All Routes ({routes.length})
              </h2>
            </CardHeader>
            <CardContent>
              {routes.length === 0 ? (
                <div className="text-center py-12">
                  <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No routes
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new route.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRoute?.id === route.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedRoute(route)}
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">
                          {route.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {route.school.name}
                          {route._count && (
                            <span className="ml-2">
                              • {route._count.stops} stop
                              {route._count.stops !== 1 ? "s" : ""} •{" "}
                              {route._count.trips} trip
                              {route._count.trips !== 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                        {route.description && (
                          <p className="text-sm text-gray-400 mt-1">
                            {route.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRouteEdit(route);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRouteDelete(route);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stops Management */}
      {selectedRoute && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Stop Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingStop ? "Edit Stop" : "Add Stop"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Route: {selectedRoute.name}
                  </p>
                </div>
                {editingStop && (
                  <button
                    onClick={resetStopForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStopSubmit} className="space-y-4">
                <FormField label="Stop Name" required>
                  <input
                    type="text"
                    value={stopFormState.name}
                    onChange={(e) =>
                      setStopFormState({ ...stopFormState, name: e.target.value })
                    }
                    placeholder="e.g., Main Street & Oak Ave"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>
                <FormField label="Location" required>
                  <LocationPicker
                    value={stopLocation || undefined}
                    onChange={(location) => {
                      setStopLocation(location);
                      if (location) {
                        setStopFormState({
                          ...stopFormState,
                          latitude: location.latitude.toString(),
                          longitude: location.longitude.toString(),
                        });
                      }
                    }}
                    placeholder="Search for a location or pick on map..."
                  />
                </FormField>
                <FormField label="Order (optional)">
                  <input
                    type="number"
                    value={stopFormState.order}
                    onChange={(e) =>
                      setStopFormState({ ...stopFormState, order: e.target.value })
                    }
                    placeholder="Auto-assigned if empty"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving
                    ? "Saving..."
                    : editingStop
                    ? "Update Stop"
                    : "Add Stop"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Stops List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">
                  Stops ({stops.length})
                </h2>
              </CardHeader>
              <CardContent>
                {stops.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPinIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No stops
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Add stops to this route.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stops.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleStopOrderChange(stop, "up")}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUpIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStopOrderChange(stop, "down")}
                              disabled={index === stops.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDownIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                            {stop.order + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">
                              {stop.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {stop.latitude.toFixed(6)},{" "}
                              {stop.longitude.toFixed(6)}
                              {stop._count && (
                                <span className="ml-2">
                                  • {stop._count.students} student
                                  {stop._count.students !== 1 ? "s" : ""}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStopEdit(stop)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleStopDelete(stop)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

