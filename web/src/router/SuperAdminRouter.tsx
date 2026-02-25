import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/modules/auth/pages/LoginPage';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { PublicRoute } from '@/components/layout/PublicRoute';
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage';
import { VerifyOTPPage } from '@/modules/auth/pages/VerifyOTPPage';
import { ResetPasswordPage } from '@/modules/auth/pages/ResetPasswordPage';
import { TenantManagement } from '@/modules/super-admin/pages/TenantManagement';
import { TenantDetails } from '@/modules/super-admin/pages/TenantDetails';
import { Layout, Menu, Avatar, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    DashboardOutlined,
    TeamOutlined,
    LogoutOutlined,
    UserOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;


const SuperAdminLayout = ({ children }: { children: React.ReactNode }) => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await logout();
            message.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            message.error('Logout failed, but you have been logged out locally');
        }
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Profile',
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            danger: true,
            onClick: handleLogout,
        },
    ];

    const menuItems: MenuProps['items'] = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
            onClick: () => navigate('/dashboard'),
        },
        {
            key: '/tenants',
            icon: <TeamOutlined />,
            label: 'Tenant Management',
            onClick: () => navigate('/tenants'),
        },
    ];

    
    const selectedKey = location.pathname.startsWith('/tenants') ? '/tenants' : location.pathname;

    return (
        <Layout className="min-h-screen">
            <Sider
                theme="dark"
                width={250}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
            >
                <div className="h-16 flex items-center justify-center border-b border-gray-700">
                    <h1 className="text-white text-xl font-bold">Super Admin</h1>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    items={menuItems}
                    className="mt-4"
                />
            </Sider>

            <Layout style={{ marginLeft: 250 }}>
                <Header className="bg-white shadow-sm px-6 flex items-center justify-between" style={{ padding: '0 24px' }}>
                    <div className="text-lg font-semibold text-gray-800">
                        School Management Platform
                    </div>
                    <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                        <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg transition">
                            <Avatar icon={<UserOutlined />} className="bg-indigo-600" />
                            <div className="text-sm">
                                <div className="font-semibold text-gray-900">{user?.name}</div>
                                <div className="text-gray-500 text-xs">Super Administrator</div>
                            </div>
                        </div>
                    </Dropdown>
                </Header>

                <Content className="m-6">
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};


const Dashboard = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Tenants" value="12" change="+2 this month" />
                <StatCard title="Total Users" value="1,234" change="+45 this week" />
                <StatCard title="Active Sessions" value="89" change="Currently online" />
                <StatCard title="System Health" value="98%" change="All systems operational" />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
                <p className="text-gray-600">Activity logs and recent tenant actions will appear here...</p>
            </div>
        </div>
    );
};


const StatCard = ({ title, value, change }: { title: string; value: string; change: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600 mb-2">{title}</div>
        <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm text-green-600">{change}</div>
    </div>
);

export const SuperAdminRouter = () => {
    return (
        <Routes>
            <Route element={<PublicRoute type="admin" />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/verify-otp" element={<VerifyOTPPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
                <Route element={<SuperAdminLayout><Dashboard /></SuperAdminLayout>} path="/dashboard" />
                <Route element={<SuperAdminLayout><TenantManagement /></SuperAdminLayout>} path="/tenants" />
                <Route element={<SuperAdminLayout><TenantDetails /></SuperAdminLayout>} path="/tenants/:id" />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
};
