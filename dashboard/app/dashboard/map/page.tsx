"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from "@react-google-maps/api";
import api from "@/lib/api";
import { Driver, Ride } from "@/types";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

// Default center will be set based on user's location
const defaultCenter = {
  lat: 0,
  lng: 0,
};

const libraries: ("drawing" | "geometry" | "places" | "visualization")[] = ["places"];

interface DriverLocation {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  name: string;
  status: string;
  vehicleType: string;
}

interface ActiveRide extends Ride {
  pickup?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
}

export default function MapPage() {
  const [drivers, setDrivers] = useState<Record<string, DriverLocation>>({});
  const [activeRides, setActiveRides] = useState<Record<string, ActiveRide>>({});
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [selectedRide, setSelectedRide] = useState<ActiveRide | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(12);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVehicleType, setFilterVehicleType] = useState<string>("all");
  const [showActiveRides, setShowActiveRides] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [hasAutoFitted, setHasAutoFitted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    // Get WebSocket URL from environment or use default
    let wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";
    
    // Ensure the URL is properly formatted (remove any trailing slashes, ensure ws:// or wss:// prefix)
    wsUrl = wsUrl.trim();
    if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
      wsUrl = `ws://${wsUrl}`;
    }
    // Remove trailing slash if present
    wsUrl = wsUrl.replace(/\/$/, "");
    
    // Construct the full WebSocket URL with query parameter
    const fullWsUrl = `${wsUrl}?role=admin`;
    
    console.log("🔌 Connecting to WebSocket:", fullWsUrl);
    console.log("📍 Environment URL:", process.env.NEXT_PUBLIC_WEBSOCKET_URL);
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(fullWsUrl);
    } catch (error: any) {
      console.error("Failed to create WebSocket:", error);
      setIsConnected(false);
      setLocationError(`Failed to create WebSocket connection: ${error.message || error}`);
      return;
    }
    
    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.error("WebSocket connection timeout");
        ws.close();
        setIsConnected(false);
        setLocationError("Connection timeout. Please check if the WebSocket server is running and accessible.");
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log("✅ Connected to WebSocket server");
      setIsConnected(true);
      setLocationError("");
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log("Disconnected from WebSocket server", event.code, event.reason);
      setIsConnected(false);
      if (event.code !== 1000) {
        // Not a normal closure
        setLocationError(`Connection closed unexpectedly (code: ${event.code}). Server may have stopped.`);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error("WebSocket error:", error);
      console.error("Failed to connect to:", fullWsUrl);
      console.error("Make sure the WebSocket server is running on port 8080");
      setIsConnected(false);
      setLocationError(`WebSocket connection failed. Trying to connect to: ${fullWsUrl}. Make sure the server is running.`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "driverLocations") {
          setDrivers(data.drivers);
        } else if (data.type === "driverLocationUpdate") {
          setDrivers((prev) => ({
            ...prev,
            [data.driver.id]: data.driver,
          }));
        } else if (data.type === "activeRides") {
          setActiveRides(data.rides);
        } else if (data.type === "activeRidesUpdate") {
          setActiveRides(data.rides);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    wsRef.current = ws;

    return () => {
      clearTimeout(connectionTimeout);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  // Fetch active rides from API
  useEffect(() => {
    const fetchActiveRides = async () => {
      try {
        const response = await api.get("/admin/rides", {
          params: {
            status: "In Progress,Accepted",
            limit: 100,
          },
        });
        // Process rides to get locations
        const ridesMap: Record<string, ActiveRide> = {};
        response.data.rides.forEach((ride: Ride) => {
          if (ride.status === "In Progress" || ride.status === "Accepted") {
            ridesMap[ride.id] = ride as ActiveRide;
          }
        });
        setActiveRides(ridesMap);
      } catch (error) {
        console.error("Error fetching active rides:", error);
      }
    };

    fetchActiveRides();
    const interval = setInterval(fetchActiveRides, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          setMapCenter(location);
          setMapZoom(13);
          console.log("User location:", location);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Unable to get your location. Using default view.");
          // Fallback to a reasonable default if geolocation fails
          // You can set this to your city's coordinates
          setMapCenter({ lat: 40.7128, lng: -74.0060 }); // New York as fallback
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  }, []);

  // Auto-fit map to show all drivers when they first appear
  // Only auto-fit once when drivers are first loaded, not on every filter change
  useEffect(() => {
    if (mapRef.current && Object.keys(drivers).length > 0 && !hasAutoFitted) {
      const filtered = Object.values(drivers).filter((driver) => {
        if (filterStatus !== "all" && driver.status !== filterStatus) return false;
        if (filterVehicleType !== "all" && driver.vehicleType !== filterVehicleType) return false;
        return true;
      });

      if (filtered.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        
        // Add user location if available
        if (userLocation) {
          bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        
        // Add all driver locations
        filtered.forEach((driver) => {
          bounds.extend(new google.maps.LatLng(driver.latitude, driver.longitude));
        });

        // Add active ride locations if showing
        if (showActiveRides) {
          Object.values(activeRides).forEach((ride) => {
            if (ride.pickup) {
              bounds.extend(new google.maps.LatLng(ride.pickup.lat, ride.pickup.lng));
            }
            if (ride.destination) {
              bounds.extend(new google.maps.LatLng(ride.destination.lat, ride.destination.lng));
            }
          });
        }

        // Only fit bounds if we have at least one location
        if (bounds.getNorthEast() && bounds.getSouthWest()) {
          mapRef.current.fitBounds(bounds);
          
          // Set a maximum zoom level to prevent too much zoom out
          google.maps.event.addListenerOnce(mapRef.current, "bounds_changed", () => {
            if (mapRef.current) {
              const currentZoom = mapRef.current.getZoom();
              if (currentZoom && currentZoom > 15) {
                mapRef.current.setZoom(15);
              }
            }
          });
          
          setHasAutoFitted(true);
        }
      }
    }
  }, [drivers, filterStatus, filterVehicleType, showActiveRides, activeRides, userLocation, hasAutoFitted]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const centerOnUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setCenter(userLocation);
      mapRef.current.setZoom(13);
    } else {
      // Request location again
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(location);
            if (mapRef.current) {
              mapRef.current.setCenter(location);
              mapRef.current.setZoom(13);
            }
          },
          (error) => {
            alert("Unable to get your location. Please enable location permissions.");
          }
        );
      }
    }
  };

  const fitAllDrivers = () => {
    if (mapRef.current) {
      const filtered = Object.values(drivers).filter((driver) => {
        if (filterStatus !== "all" && driver.status !== filterStatus) return false;
        if (filterVehicleType !== "all" && driver.vehicleType !== filterVehicleType) return false;
        return true;
      });

      if (filtered.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        
        // Include user location if available
        if (userLocation) {
          bounds.extend(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        }
        
        // Add all filtered driver locations
        filtered.forEach((driver) => {
          bounds.extend(new google.maps.LatLng(driver.latitude, driver.longitude));
        });
        
        // Add active ride locations if showing
        if (showActiveRides) {
          Object.values(activeRides).forEach((ride) => {
            if (ride.pickup) {
              bounds.extend(new google.maps.LatLng(ride.pickup.lat, ride.pickup.lng));
            }
            if (ride.destination) {
              bounds.extend(new google.maps.LatLng(ride.destination.lat, ride.destination.lng));
            }
          });
        }
        
        if (bounds.getNorthEast() && bounds.getSouthWest()) {
          mapRef.current.fitBounds(bounds);
          
          // Set maximum zoom to prevent too much zoom out
          google.maps.event.addListenerOnce(mapRef.current, "bounds_changed", () => {
            if (mapRef.current) {
              const currentZoom = mapRef.current.getZoom();
              if (currentZoom && currentZoom > 15) {
                mapRef.current.setZoom(15);
              }
            }
          });
        }
      } else {
        alert("No drivers to show. Please adjust your filters.");
      }
    }
  };

  const getDriverIcon = (status: string, vehicleType: string) => {
    const color = status === "active" ? "#10B981" : "#6B7280";
    // Use a simple colored circle as marker
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    };
  };

  const filteredDrivers = Object.values(drivers).filter((driver) => {
    if (filterStatus !== "all" && driver.status !== filterStatus) return false;
    if (filterVehicleType !== "all" && driver.vehicleType !== filterVehicleType) return false;
    return true;
  });

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-2">Google Maps API Key is missing</p>
          <p className="text-gray-600 text-sm">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ marginTop: 0, paddingTop: 0 }}>
      {/* Controls */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Vehicle:</span>
            <select
              value={filterVehicleType}
              onChange={(e) => setFilterVehicleType(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All</option>
              <option value="Car">Car</option>
              <option value="Motorcycle">Motorcycle</option>
              <option value="CNG">CNG</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveRides}
              onChange={(e) => setShowActiveRides(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Show Active Rides</span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="text-sm text-gray-600">
            Drivers: {filteredDrivers.length} | Active Rides: {Object.keys(activeRides).length}
          </div>

          <div className="flex gap-2">
            <button
              onClick={centerOnUserLocation}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              title="Center on your location"
            >
              📍 My Location
            </button>
            <button
              onClick={fitAllDrivers}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
              title="Fit all drivers in view"
            >
              🗺️ Fit Drivers
            </button>
          </div>
        </div>
        {locationError && (
          <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">{locationError}</div>
        )}
        {!isConnected && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
            ⚠️ WebSocket disconnected. Make sure the server is running: <code className="bg-gray-200 px-1 rounded">cd socket && node server.js</code>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={onMapLoad}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {/* User Location Marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#3B82F6",
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 3,
                }}
                title="Your Location"
              />
            )}

            {/* Driver Markers */}
            {filteredDrivers.map((driver) => {
              const icon = getDriverIcon(driver.status, driver.vehicleType);
              return (
                <Marker
                  key={driver.id}
                  position={{ lat: driver.latitude, lng: driver.longitude }}
                  icon={icon}
                  onClick={() => setSelectedDriver(driver)}
                  title={driver.name}
                />
              );
            })}

            {/* Active Ride Routes */}
            {showActiveRides &&
              Object.values(activeRides).map((ride) => {
                if (!ride.pickup || !ride.destination) return null;
                return (
                  <Polyline
                    key={ride.id}
                    path={[
                      { lat: ride.pickup.lat, lng: ride.pickup.lng },
                      { lat: ride.destination.lat, lng: ride.destination.lng },
                    ]}
                    options={{
                      strokeColor: "#3B82F6",
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                    }}
                  />
                );
              })}

            {/* Driver Info Window */}
            {selectedDriver && (
              <InfoWindow
                position={{ lat: selectedDriver.latitude, lng: selectedDriver.longitude }}
                onCloseClick={() => setSelectedDriver(null)}
              >
                <div className="p-2">
                  <h3 className="font-semibold text-gray-900">{selectedDriver.name}</h3>
                  <p className="text-sm text-gray-600">Status: {selectedDriver.status}</p>
                  <p className="text-sm text-gray-600">Vehicle: {selectedDriver.vehicleType}</p>
                  <p className="text-sm text-gray-500">
                    Last update: {new Date(selectedDriver.timestamp).toLocaleTimeString()}
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = `/dashboard/drivers/${selectedDriver.id}`;
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Details →
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>
    </div>
  );
}

