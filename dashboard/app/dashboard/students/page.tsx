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
  UserIcon,
} from "@heroicons/react/24/outline";

interface School {
  id: string;
  name: string;
}

interface Stop {
  id: string;
  name: string;
  routeId: string;
  route: {
    id: string;
    name: string;
    school: {
      id: string;
      name: string;
    };
  };
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade?: string;
  studentId?: string;
  photo?: string;
  schoolId: string;
  stopId?: string;
  school: {
    id: string;
    name: string;
  };
  stop?: {
    id: string;
    name: string;
  };
  _count?: {
    parents: number;
  };
}

interface StudentFormState {
  schoolId: string;
  stopId: string;
  firstName: string;
  lastName: string;
  grade: string;
  studentId: string;
  photo: string;
}

export default function StudentsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formState, setFormState] = useState<StudentFormState>({
    schoolId: "",
    stopId: "",
    firstName: "",
    lastName: "",
    grade: "",
    studentId: "",
    photo: "",
  });
  const [filterSchoolId, setFilterSchoolId] = useState<string>("");

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
      setFormState((prev) => {
        if (!prev.schoolId && schoolsData.length > 0) {
          return { ...prev, schoolId: schoolsData[0].id };
        }
        return prev;
      });
      // Set filter to first school if none selected
      setFilterSchoolId((prev) => {
        if (!prev && schoolsData.length > 0) {
          return schoolsData[0].id;
        }
        return prev;
      });
    } catch (error) {
      console.error("Error fetching schools:", error);
    }
  }, []);

  const fetchStops = useCallback(async (schoolId?: string) => {
    try {
      const params: any = {};
      if (schoolId) {
        // First get routes for this school, then get stops
        const routesResponse = await api.get("/admin/routes", {
          params: { schoolId },
        });
        const routeIds = routesResponse.data.routes.map((r: any) => r.id);
        if (routeIds.length > 0) {
          params.routeId = routeIds.join(",");
        } else {
          setStops([]);
          return;
        }
      }
      const response = await api.get("/admin/stops", { params });
      setStops(response.data.stops || []);
    } catch (error) {
      console.error("Error fetching stops:", error);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterSchoolId) {
        params.schoolId = filterSchoolId;
      }
      const response = await api.get("/admin/students", { params });
      setStudents(response.data.students || []);
    } catch (error) {
      console.error("Error fetching students:", error);
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to load students"
          : "Failed to load students";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filterSchoolId]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (formState.schoolId) {
      fetchStops(formState.schoolId);
    }
  }, [formState.schoolId, fetchStops]);

  const resetForm = () => {
    setEditingStudent(null);
    setFormState({
      schoolId: schools[0]?.id || "",
      stopId: "",
      firstName: "",
      lastName: "",
      grade: "",
      studentId: "",
      photo: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.schoolId || !formState.firstName || !formState.lastName) {
      toast.error("School, first name, and last name are required");
      return;
    }

    try {
      setSaving(true);
      if (editingStudent) {
        await api.put(`/admin/students/${editingStudent.id}`, {
          stopId: formState.stopId || null,
          firstName: formState.firstName,
          lastName: formState.lastName,
          grade: formState.grade || null,
          studentId: formState.studentId || null,
          photo: formState.photo || null,
        });
        toast.success("Student updated");
      } else {
        await api.post("/admin/students", {
          schoolId: formState.schoolId,
          stopId: formState.stopId || null,
          firstName: formState.firstName,
          lastName: formState.lastName,
          grade: formState.grade || null,
          studentId: formState.studentId || null,
          photo: formState.photo || null,
        });
        toast.success("Student created");
      }
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(getErrorMessage(error, "Failed to save student"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormState({
      schoolId: student.schoolId,
      stopId: student.stopId || "",
      firstName: student.firstName,
      lastName: student.lastName,
      grade: student.grade || "",
      studentId: student.studentId || "",
      photo: student.photo || "",
    });
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`Delete student "${student.firstName} ${student.lastName}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/students/${student.id}`);
      toast.success("Student deleted");
      if (editingStudent?.id === student.id) {
        resetForm();
      }
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error(getErrorMessage(error, "Failed to delete student"));
    }
  };

  const filteredStops = stops.filter(
    (stop) => !formState.schoolId || stop.route.school.id === formState.schoolId
  );

  if (loading && students.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage students and assign them to pickup stops
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingStudent ? "Edit Student" : "Add Student"}
                </h2>
              </div>
              {editingStudent && (
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
              <FormField label="School" required>
                <select
                  value={formState.schoolId}
                  onChange={(e) =>
                    setFormState({ ...formState, schoolId: e.target.value, stopId: "" })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Pickup Stop">
                <select
                  value={formState.stopId}
                  onChange={(e) =>
                    setFormState({ ...formState, stopId: e.target.value })
                  }
                  disabled={!formState.schoolId}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white disabled:bg-gray-100"
                >
                  <option value="">No stop assigned</option>
                  {filteredStops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.route.school.name} - {stop.route.name} - {stop.name}
                    </option>
                  ))}
                </select>
              </FormField>
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
              <FormField label="Grade">
                <input
                  type="text"
                  value={formState.grade}
                  onChange={(e) =>
                    setFormState({ ...formState, grade: e.target.value })
                  }
                  placeholder="e.g., Grade 5"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Student ID">
                <input
                  type="text"
                  value={formState.studentId}
                  onChange={(e) =>
                    setFormState({ ...formState, studentId: e.target.value })
                  }
                  placeholder="School's student ID"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <FormField label="Photo URL">
                <input
                  type="url"
                  value={formState.photo}
                  onChange={(e) =>
                    setFormState({ ...formState, photo: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 bg-white"
                />
              </FormField>
              <Button type="submit" disabled={saving} className="w-full">
                {saving
                  ? "Saving..."
                  : editingStudent
                  ? "Update Student"
                  : "Create Student"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    All Students ({students.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={filterSchoolId}
                    onChange={(e) => setFilterSchoolId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">All Schools</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-12">
                  <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No students
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new student.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {student.photo ? (
                          <img
                            src={student.photo}
                            alt={`${student.firstName} ${student.lastName}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-indigo-600" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </h3>
                          <div className="text-sm text-gray-500 space-y-1 mt-1">
                            <p>
                              {student.school.name}
                              {student.grade && ` • ${student.grade}`}
                              {student.studentId && ` • ID: ${student.studentId}`}
                            </p>
                            {student.stop ? (
                              <p className="text-indigo-600">
                                📍 {student.stop.name}
                              </p>
                            ) : (
                              <p className="text-amber-600">⚠️ No stop assigned</p>
                            )}
                            {student._count && (
                              <p>
                                {student._count.parents} parent
                                {student._count.parents !== 1 ? "s" : ""} linked
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
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

