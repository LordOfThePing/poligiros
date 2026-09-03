import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { AuthProvider, ProtectedRoute } from "@/lib/auth"
import { Toaster } from "@/components/ui/toaster"
import { SupervisorSidebar } from "@/components/supervisor/Sidebar"
import { StudentSidebar } from "@/components/student/Sidebar"

// Pages - public
import LoginPage from "@/pages/LoginPage"
import RegisterPage from "@/pages/RegisterPage"
import TokenPage from "@/pages/client/TokenPage"
import ChangePasswordPage from "@/pages/ChangePasswordPage"

// Pages - supervisor
import SupervisorPanelPage from "@/pages/supervisor/PanelPage"
import SupervisorAlumnosPage from "@/pages/supervisor/AlumnosPage"
import SupervisorAlumnoDetailPage from "@/pages/supervisor/AlumnoDetailPage"
import SupervisorSupervisionPage from "@/pages/supervisor/SupervisionPage"
import SupervisorSupervisionDetailPage from "@/pages/supervisor/SupervisionDetailPage"
import SupervisorRegistrosPage from "@/pages/supervisor/RegistrosPage"
import SupervisorModulosPage from "@/pages/supervisor/ModulosPage"
import SupervisorCohortesPage from "@/pages/supervisor/CohortesPage"
import SupervisorPoolsPage from "@/pages/supervisor/PoolsPage"
import SupervisorInscripcionesPage from "@/pages/supervisor/InscripcionesPage"
import SupervisorEntregasPage from "@/pages/supervisor/EntregasPage"
import SupervisorPreviewPage from "@/pages/supervisor/PreviewPage"
import SupervisorConfiguracionPage from "@/pages/supervisor/ConfiguracionPage"
import SupervisorSupervisionResultPage from "@/pages/supervisor/SupervisionResultPage"
import InscripcionPage from "@/pages/InscripcionPage"

// Pages - student
import StudentProgramaPage from "@/pages/student/ProgramaPage"
import StudentMyTestsPage from "@/pages/student/MyTestsPage"
import StudentTakeTestPage from "@/pages/student/TakeTestPage"
import StudentClientesPage from "@/pages/student/ClientesPage"
import StudentClientDetailPage from "@/pages/student/ClientDetailPage"
import StudentSupervisionPage from "@/pages/student/SupervisionPage"
import StudentRegistrosPage from "@/pages/student/RegistrosPage"
import StudentNuevoRegistroPage from "@/pages/student/NuevoRegistroPage"

// Below lg the sidebar is a hidden drawer (see CollapsibleSidebar) reached via
// its own top bar, so main content clears that bar (pt-14) and drops the rail
// offset (lg:pl-16). The inner wrapper also trims to a tighter, edge-to-edge
// gutter on phones — max-w-7xl's centering padding reads as wasted margin on
// a narrow screen — and only grows into the padded, centered card at sm+.
function SupervisorLayout() {
  return (
    <div className="h-dvh overflow-hidden bg-brand-bg">
      <SupervisorSidebar />
      {/* pl-16 reserves the collapsed rail; the expanded sidebar overlays over
          the content instead of shifting it. */}
      <main className="h-full overflow-y-auto pt-14 lg:pt-0 lg:pl-16">
        <div className="p-3 sm:p-6 lg:max-w-7xl lg:mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function StudentLayout() {
  return (
    <div className="h-dvh overflow-hidden bg-brand-bg">
      <StudentSidebar />
      <main className="h-full overflow-y-auto pt-14 lg:pt-0 lg:pl-16">
        <div className="p-3 sm:p-6 lg:max-w-7xl lg:mx-auto">
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
          <Route path="/invite/:token" element={<RegisterPage />} />
          <Route path="/t/:token" element={<TokenPage />} />
          <Route path="/inscripcion/:token" element={<InscripcionPage />} />
          <Route path="/cambiar-password" element={<ChangePasswordPage />} />

          {/* Standalone (no sidebar) — opened as a new tab from the supervisor's
              detail page so a viewport-height result layout (Tablero de Ideas)
              renders correctly. */}
          <Route
            path="/supervisor/supervision/:id/vista"
            element={
              <ProtectedRoute roles={["SUPERVISOR"]}>
                <SupervisorSupervisionResultPage />
              </ProtectedRoute>
            }
          />

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
            <Route path="pools" element={<SupervisorPoolsPage />} />
            <Route path="entregas" element={<SupervisorEntregasPage />} />
            <Route path="inscripciones" element={<SupervisorInscripcionesPage />} />
            <Route path="preview" element={<SupervisorPreviewPage />} />
            <Route path="configuracion" element={<SupervisorConfiguracionPage />} />
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
            <Route path="my-tests" element={<StudentMyTestsPage />} />
            <Route path="my-tests/:id" element={<StudentTakeTestPage />} />
            <Route path="clientes" element={<StudentClientesPage />} />
            <Route path="clientes/:id" element={<StudentClientDetailPage />} />
            <Route path="supervision" element={<StudentSupervisionPage />} />
            <Route path="registros" element={<StudentRegistrosPage />} />
            <Route path="registros/nuevo" element={<StudentNuevoRegistroPage />} />
            <Route path="registros/:id/editar" element={<StudentNuevoRegistroPage />} />
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
