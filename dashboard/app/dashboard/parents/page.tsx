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
  UserGroupIcon,
  LinkIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  isVerified: boolean;
  _count?: {
    students: number;
  };
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  school: {
    id: string;
    name: string;
  };
}

interface ParentStudentLink {
  id: string;
  relationship: string;
  isPrimary: boolean;
  student: Student;
}

interface ParentDetail extends Parent {
  students: ParentStudentLink[];
}

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
  });
  const [linkFormState, setLinkFormState] = useState({
    studentId: "",
    relationship: "parent",
    isPrimary: false,
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

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/parents");
      setParents(response.data.parents || []);
    } catch (error) {
      console.error("Error fetching parents:", error);
      toast.error(getErrorMessage(error, "Failed to load parents"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchParentDetail = useCallback(async (parentId: string) => {
    try {
      const response = await api.get(`/admin/parents/${parentId}`);
      const parent = response.data.parent;
      // Transform the response to match the expected structure
      // Backend returns parentStudents, but frontend expects students
      const transformedParent = {
        ...parent,
        students: parent.parentStudents || [], // Backend returns parentStudents array
      };
      console.log("Fetched parent detail:", {
        parentId,
        studentsCount: transformedParent.students.length,
        students: transformedParent.students,
      });
      setSelectedParent(transformedParent);
    } catch (error) {
      console.error("Error fetching parent detail:", error);
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to load parent details"
          : "Failed to load parent details";
      toast.error(errorMessage);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const response = await api.get("/admin/students");
      setStudents(response.data.students || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }, []);

  useEffect(() => {
    fetchParents();
    fetchStudents();
  }, [fetchParents, fetchStudents]);

  const resetForm = () => {
    setEditingParent(null);
    setFormState({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
    });
  };

  const resetLinkForm = () => {
    setLinkFormState({
      studentId: "",
      relationship: "parent",
      isPrimary: false,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.firstName || !formState.lastName) {
      toast.error("First name and last name are required");
      return;
    }

    try {
      setSaving(true);
      if (editingParent) {
        await api.put(`/admin/parents/${editingParent.id}`, {
          firstName: formState.firstName,
          lastName: formState.lastName,
          phoneNumber: formState.phoneNumber || undefined,
          email: formState.email || undefined,
        });
        toast.success("Parent updated");
      } else {
        toast.error("Parent creation should be done through the parent app");
        return;
      }
      resetForm();
      fetchParents();
      if (selectedParent?.id === editingParent?.id) {
        fetchParentDetail(editingParent.id);
      }
    } catch (error) {
      console.error("Error saving parent:", error);
      toast.error(getErrorMessage(error, "Failed to save parent"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (parent: Parent) => {
    setEditingParent(parent);
    setFormState({
      firstName: parent.firstName,
      lastName: parent.lastName,
      phoneNumber: parent.phoneNumber,
      email: parent.email || "",
    });
  };

  const handleDelete = async (parent: Parent) => {
    if (!confirm(`Delete parent "${parent.firstName} ${parent.lastName}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/parents/${parent.id}`);
      toast.success("Parent deleted");
      if (editingParent?.id === parent.id) {
        resetForm();
      }
      if (selectedParent?.id === parent.id) {
        setSelectedParent(null);
      }
      fetchParents();
    } catch (error) {
      console.error("Error deleting parent:", error);
      toast.error(getErrorMessage(error, "Failed to delete parent"));
    }
  };

  const handleLinkStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedParent || !linkFormState.studentId) {
      toast.error("Please select a student");
      return;
    }

    try {
      setSaving(true);
      await api.post("/admin/parent-students", {
        parentId: selectedParent.id,
        studentId: linkFormState.studentId,
        relationship: linkFormState.relationship,
        isPrimary: linkFormState.isPrimary,
      });
      toast.success("Student linked to parent");
      resetLinkForm();
      fetchParentDetail(selectedParent.id);
      fetchParents();
    } catch (error) {
      console.error("Error linking student:", error);
      toast.error(getErrorMessage(error, "Failed to link student"));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkStudent = async (studentId: string) => {
    if (!selectedParent) return;
    if (!confirm("Unlink this student from parent?")) {
      return;
    }

    try {
      await api.delete(
        `/admin/parent-students/${selectedParent.id}/${studentId}`
      );
      toast.success("Student unlinked");
      fetchParentDetail(selectedParent.id);
      fetchParents();
    } catch (error) {
      console.error("Error unlinking student:", error);
      toast.error(getErrorMessage(error, "Failed to unlink student"));
    }
  };

  const handleUpdateLink = async (
    studentId: string,
    relationship: string,
    isPrimary: boolean
  ) => {
    if (!selectedParent) return;

    try {
      await api.put(
        `/admin/parent-students/${selectedParent.id}/${studentId}`,
        {
          relationship,
          isPrimary,
        }
      );
      toast.success("Link updated");
      fetchParentDetail(selectedParent.id);
      fetchParents();
    } catch (error) {
      console.error("Error updating link:", error);
      toast.error(getErrorMessage(error, "Failed to update link"));
    }
  };

  const availableStudents = students.filter(
    (student) =>
      !selectedParent?.students.some((link) => link.student.id === student.id)
  );

  if (loading && parents.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Parents</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage parents and link them to students
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parent Edit Form */}
        {editingParent && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Edit Parent
                  </h2>
                </div>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="First Name" required>
                  <input
                    type="text"
                    value={formState.firstName}
                    onChange={(e) =>
                      setFormState({ ...formState, firstName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <input
                    type="text"
                    value={formState.lastName}
                    onChange={(e) =>
                      setFormState({ ...formState, lastName: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>
                <FormField label="Phone Number">
                  <input
                    type="tel"
                    value={formState.phoneNumber}
                    onChange={(e) =>
                      setFormState({ ...formState, phoneNumber: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                    disabled
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) =>
                      setFormState({ ...formState, email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  />
                </FormField>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Update Parent"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Parents List */}
        <div className={editingParent ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                All Parents ({parents.length})
              </h2>
            </CardHeader>
            <CardContent>
              {parents.length === 0 ? (
                <div className="text-center py-12">
                  <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No parents
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Parents register through the mobile app.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {parents.map((parent) => (
                    <div
                      key={parent.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedParent?.id === parent.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => fetchParentDetail(parent.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                            <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {parent.firstName} {parent.lastName}
                            </h3>
                            <div className="text-sm text-gray-500 space-y-1 mt-1">
                              <p>📞 {parent.phoneNumber}</p>
                              {parent.email && <p>✉️ {parent.email}</p>}
                              <p>
                                {parent.isVerified ? (
                                  <span className="text-green-600">✓ Verified</span>
                                ) : (
                                  <span className="text-amber-600">⚠ Not verified</span>
                                )}
                                {parent._count && (
                                  <span className="ml-2">
                                    • {parent._count.students} student
                                    {parent._count.students !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(parent);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(parent);
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

      {/* Parent Detail & Student Linking */}
      {selectedParent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Link Student Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">
                Link Student
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedParent.firstName} {selectedParent.lastName}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLinkStudent} className="space-y-4">
                <FormField label="Student" required>
                  <select
                    value={linkFormState.studentId}
                    onChange={(e) =>
                      setLinkFormState({
                        ...linkFormState,
                        studentId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  >
                    <option value="">Select a student</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.school.name})
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Relationship">
                  <select
                    value={linkFormState.relationship}
                    onChange={(e) =>
                      setLinkFormState({
                        ...linkFormState,
                        relationship: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                  >
                    <option value="parent">Parent</option>
                    <option value="guardian">Guardian</option>
                    <option value="emergency_contact">Emergency Contact</option>
                  </select>
                </FormField>
                <FormField label="">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={linkFormState.isPrimary}
                      onChange={(e) =>
                        setLinkFormState({
                          ...linkFormState,
                          isPrimary: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">Primary contact</span>
                  </label>
                </FormField>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? "Linking..." : "Link Student"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Linked Students List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">
                  Linked Students ({selectedParent.students.length})
                </h2>
              </CardHeader>
              <CardContent>
                {selectedParent.students.length === 0 ? (
                  <div className="text-center py-12">
                    <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No students linked
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Link students using the form on the left.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedParent.students.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {link.student.firstName} {link.student.lastName}
                              </h3>
                              <div className="text-sm text-gray-500 space-y-1 mt-1">
                                <p>{link.student.school.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                    {link.relationship}
                                  </span>
                                  {link.isPrimary && (
                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                      Primary
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleUpdateLink(
                                link.student.id,
                                link.relationship === "parent"
                                  ? "guardian"
                                  : link.relationship === "guardian"
                                  ? "emergency_contact"
                                  : "parent",
                                !link.isPrimary
                              )
                            }
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Toggle primary"
                          >
                            <LinkIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleUnlinkStudent(link.student.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Unlink"
                          >
                            <XCircleIcon className="h-5 w-5" />
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

