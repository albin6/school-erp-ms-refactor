import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { TenantProtectedRoute } from '@/components/layout/TenantProtectedRoute';
import { TenantAdminLayout } from '@/modules/tenant/components/layout/TenantAdminLayout';
import { TenantStaffLayout } from '@/modules/tenant/components/layout/TenantStaffLayout';
import { TenantStudentLayout } from '@/modules/tenant/components/layout/TenantStudentLayout';
import { PublicRoute } from '@/components/layout/PublicRoute';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { useTenantAuthStore } from '@/store/tenantAuthStore';

const TenantAdminLogin = lazy(() => import('@/modules/tenant/pages/TenantAdminLogin').then(module => ({ default: module.TenantAdminLogin })));
const TenantStaffLogin = lazy(() => import('@/modules/tenant/pages/TenantStaffLogin').then(module => ({ default: module.TenantStaffLogin })));
const TenantStudentLogin = lazy(() => import('@/modules/tenant/pages/TenantStudentLogin').then(module => ({ default: module.TenantStudentLogin })));
const TenantAdminDashboard = lazy(() => import('@/modules/tenant/pages/TenantAdminDashboard'));
const TenantLandingPage = lazy(() => import('@/modules/tenant/pages/TenantLandingPage').then(module => ({ default: module.TenantLandingPage })));
const StaffDashboard = lazy(() => import('@/modules/tenant/pages/StaffDashboard').then(module => ({ default: module.StaffDashboard })));
const StudentDashboard = lazy(() => import('@/modules/tenant/pages/StudentDashboard').then(module => ({ default: module.StudentDashboard })));
const TenantPasswordReset = lazy(() => import('@/modules/tenant/pages/TenantPasswordReset').then(module => ({ default: module.TenantPasswordReset })));
const ForgotPasswordPage = lazy(() => import('@/modules/auth/pages/ForgotPasswordPage').then(module => ({ default: module.ForgotPasswordPage })));
const VerifyOTPPage = lazy(() => import('@/modules/auth/pages/VerifyOTPPage').then(module => ({ default: module.VerifyOTPPage })));
const ResetPasswordPage = lazy(() => import('@/modules/auth/pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));
const BranchManagement = lazy(() => import('@/modules/tenant/pages/BranchManagement').then(module => ({ default: module.BranchManagement })));
const AcademicManagement = lazy(() => import('@/modules/tenant/pages/AcademicManagement').then(module => ({ default: module.AcademicManagement })));
const UserManagement = lazy(() => import('@/modules/tenant/pages/UserManagement').then(module => ({ default: module.UserManagement })));
const BranchSelection = lazy(() => import('@/modules/tenant/pages/users/BranchSelection').then(module => ({ default: module.BranchSelection })));

const StudentsManagement = lazy(() => import('@/modules/tenant/pages/StudentsManagement').then(module => ({ default: module.StudentsManagement })));

const StudentPortalEntry = () => {
    const { isAuthenticated, user } = useTenantAuthStore();

    if (isAuthenticated && user?.role === 'STUDENT') {

        return <Navigate to="dashboard" replace />;
    }

    return (
        <PublicRoute type="tenant">
            <TenantStudentLogin />
        </PublicRoute>
    );
};

export const TenantRouter = () => {
    return (
        <Suspense fallback={<FullPageLoader tip="Loading Portal..." />}>
            <Routes>
                { }
                <Route path="/" element={<TenantLandingPage />} />

                <Route element={<PublicRoute type="tenant" />}>
                    <Route path="/admin" element={<TenantAdminLogin />} />
                    <Route path="/admin/reset-password" element={<TenantPasswordReset />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/verify-otp" element={<VerifyOTPPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                { }
                <Route element={<TenantProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route element={<TenantAdminLayout />}>
                        <Route path="/admin/dashboard" element={<TenantAdminDashboard />} />
                        <Route path="/admin/branches" element={<BranchManagement />} />
                        <Route path="/admin/academic" element={<AcademicManagement />} />
                        <Route path="/admin/users" element={<BranchSelection />} />
                        <Route path="/admin/users/:branchId" element={<UserManagement />} />
                        <Route path="/admin/students" element={<StudentsManagement />} />
                    </Route>
                </Route>

                { }
                <Route path="/404" element={<NotFoundPage />} />

                { }
                <Route path="/:slug">
                    { }
                    <Route index element={<StudentPortalEntry />} />

                    {}
                    <Route element={<TenantStudentLayout />}>
                        <Route path="dashboard" element={
                            <TenantProtectedRoute allowedRoles={['STUDENT']}>
                                <StudentDashboard />
                            </TenantProtectedRoute>
                        } />
                    </Route>

                    { }
                    <Route path="staff">
                        { }
                        <Route index element={
                            <PublicRoute type="tenant">
                                <TenantStaffLogin />
                            </PublicRoute>
                        } />

                        {}
                        <Route element={<TenantStaffLayout />}>
                            <Route element={<TenantProtectedRoute allowedRoles={['STAFF']} />}>
                                {}
                                <Route path="dashboard" element={<StaffDashboard />} />

                                <Route path="principal" element={
                                    <TenantProtectedRoute allowedRoles={['STAFF']} allowedSubRoles={['PRINCIPAL']}>
                                        <StaffDashboard />
                                    </TenantProtectedRoute>
                                } />

                                <Route path="teacher" element={
                                    <TenantProtectedRoute allowedRoles={['STAFF']} allowedSubRoles={['TEACHER']}>
                                        <StaffDashboard />
                                    </TenantProtectedRoute>
                                } />

                                <Route path="office-staff" element={
                                    <TenantProtectedRoute allowedRoles={['STAFF']} allowedSubRoles={['OFFICE_STAFF']}>
                                        <StaffDashboard />
                                    </TenantProtectedRoute>
                                } />

                                <Route path="office-assistant" element={
                                    <TenantProtectedRoute allowedRoles={['STAFF']} allowedSubRoles={['OFFICE_ASSISTANT']}>
                                        <StaffDashboard />
                                    </TenantProtectedRoute>
                                } />
                            </Route>
                        </Route>
                    </Route>
                </Route>

                { }
                <Route path="/unauthorized" element={<div className="text-center mt-20"><h1 className="text-2xl">Unauthorized Access</h1></div>} />

                { }
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
};
