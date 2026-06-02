import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { AuthProvider, ProtectedRoute } from "@/lib/auth"
import { Toaster } from "@/components/ui/toaster"
import { SupervisorSidebar } from "@/components/supervisor/Sidebar"
import { StudentSidebar } from "@/components/student/Sidebar"

// Pages - public
import LoginPage from "@/pages/LoginPage"
import TokenPage from "@/pages/client/TokenPage"

// Pages - supervisor
import SupervisorPanelPage from "@/pages/supervisor/PanelPage"
import SupervisorAlumnosPage from "@/pages/supervisor/AlumnosPage"
import SupervisorAlumnoDetailPage from "@/pages/supervisor/AlumnoDetailPage"
import SupervisorSupervisionPage from "@/pages/supervisor/SupervisionPage"
import SupervisorSupervisionDetailPage from "@/pages/supervisor/SupervisionDetailPage"
import SupervisorRegistrosPage from "@/pages/supervisor/RegistrosPage"
import SupervisorModulosPage from "@/pages/supervisor/ModulosPage"
import SupervisorCohortesPage from "@/pages/supervisor/CohortesPage"

// Pages - student
import StudentProgramaPage from "@/pages/student/ProgramaPage"
import StudentModuleDetailPage from "@/pages/student/ModuleDetailPage"
import StudentClientesPage from "@/pages/student/ClientesPage"
import StudentClientDetailPage from "@/pages/student/ClientDetailPage"
import StudentSupervisionPage from "@/pages/student/SupervisionPage"
import StudentRegistrosPage from "@/pages/student/RegistrosPage"
import StudentNuevoRegistroPage from "@/pages/student/NuevoRegistroPage"

function SupervisorLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg">
      <SupervisorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function StudentLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg">
      <StudentSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/t/:token" element={<TokenPage />} />

          {/* Supervisor routes */}
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute roles={["SUPERVISOR"]}>
                <SupervisorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/supervisor/panel" replace />} />
            <Route path="panel" element={<SupervisorPanelPage />} />
            <Route path="alumnos" element={<SupervisorAlumnosPage />} />
            <Route path="alumnos/:id" element={<SupervisorAlumnoDetailPage />} />
            <Route path="supervision" element={<SupervisorSupervisionPage />} />
            <Route path="supervision/:id" element={<SupervisorSupervisionDetailPage />} />
            <Route path="registros" element={<SupervisorRegistrosPage />} />
            <Route path="modulos" element={<SupervisorModulosPage />} />
            <Route path="cohortes" element={<SupervisorCohortesPage />} />
          </Route>

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute roles={["STUDENT_COACH"]}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/student/programa" replace />} />
            <Route path="programa" element={<StudentProgramaPage />} />
            <Route path="programa/:id" element={<StudentModuleDetailPage />} />
            <Route path="clientes" element={<StudentClientesPage />} />
            <Route path="clientes/:id" element={<StudentClientDetailPage />} />
            <Route path="supervision" element={<StudentSupervisionPage />} />
            <Route path="registros" element={<StudentRegistrosPage />} />
            <Route path="registros/nuevo" element={<StudentNuevoRegistroPage />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
