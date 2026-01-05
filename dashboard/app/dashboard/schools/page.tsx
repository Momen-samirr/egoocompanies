"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FormField from "@/components/common/FormField";
import {
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";

interface School {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    routes: number;
    students: number;
  };
}

interface SchoolFormState {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [formState, setFormState] = useState<SchoolFormState>({
    name: "",
    address: "",
    phoneNumber: "",
    email: "",
  });

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
      setLoading(true);
      const response = await api.get("/admin/schools");
      setSchools(response.data.schools || []);
    } catch (error) {
      console.error("Error fetching schools:", error);
      toast.error(getErrorMessage(error, "Failed to load schools"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const resetForm = () => {
    setEditingSchool(null);
    setFormState({
      name: "",
      address: "",
      phoneNumber: "",
      email: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name) {
      toast.error("School name is required");
      return;
    }

    try {
      setSaving(true);
      if (editingSchool) {
        await api.put(`/admin/schools/${editingSchool.id}`, {
          name: formState.name,
          address: formState.address || null,
          phoneNumber: formState.phoneNumber || null,
          email: formState.email || null,
        });
        toast.success("School updated");
      } else {
        await api.post("/admin/schools", {
          name: formState.name,
          address: formState.address || null,
          phoneNumber: formState.phoneNumber || null,
          email: formState.email || null,
        });
        toast.success("School created");
      }
      resetForm();
      fetchSchools();
    } catch (error) {
      console.error("Error saving school:", error);
      toast.error(getErrorMessage(error, "Failed to save school"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (school: School) => {
    setEditingSchool(school);
    setFormState({
      name: school.name,
      address: school.address || "",
      phoneNumber: school.phoneNumber || "",
      email: school.email || "",
    });
  };

  const handleDelete = async (school: School) => {
    if (!confirm(`Delete school "${school.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/schools/${school.id}`);
      toast.success("School deleted");
      if (editingSchool?.id === school.id) {
        resetForm();
      }
      fetchSchools();
    } catch (error) {
      console.error("Error deleting school:", error);
      toast.error(getErrorMessage(error, "Failed to delete school"));
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
          <h1 className="text-3xl font-bold text-gray-900">Schools</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage schools and their information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingSchool ? "Edit School" : "Add School"}
                </h2>
              </div>
              {editingSchool && (
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="School Name" required>
                <input
                  type="text"
                  name="name"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState({ ...formState, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Address">
                <input
                  type="text"
                  name="address"
                  value={formState.address}
                  onChange={(e) =>
                    setFormState({ ...formState, address: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Phone Number">
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formState.phoneNumber}
                  onChange={(e) =>
                    setFormState({ ...formState, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={(e) =>
                    setFormState({ ...formState, email: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <Button type="submit" disabled={saving} className="w-full">
                {saving
                  ? "Saving..."
                  : editingSchool
                  ? "Update School"
                  : "Create School"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                All Schools ({schools.length})
              </h2>
            </CardHeader>
            <CardContent>
              {schools.length === 0 ? (
                <div className="text-center py-12">
                  <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No schools
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new school.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schools.map((school) => (
                    <div
                      key={school.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <BuildingOfficeIcon className="h-5 w-5 text-indigo-600" />
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {school.name}
                            </h3>
                            <div className="mt-1 text-sm text-gray-500 space-y-1">
                              {school.address && (
                                <p>📍 {school.address}</p>
                              )}
                              {school.phoneNumber && (
                                <p>📞 {school.phoneNumber}</p>
                              )}
                              {school.email && <p>✉️ {school.email}</p>}
                              {school._count && (
                                <p className="mt-2">
                                  {school._count.routes} route
                                  {school._count.routes !== 1 ? "s" : ""} •{" "}
                                  {school._count.students} student
                                  {school._count.students !== 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(school)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(school)}
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
    </div>
  );
}

