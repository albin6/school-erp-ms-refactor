import { useState } from 'react';
import { Layout, Menu, Button, Typography, Dropdown, Avatar, App } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export const TenantStaffLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const { slug } = useParams<{ slug: string }>();
    const { logout, tenant, user } = useTenantAuthStore();
    const { message } = App.useApp();

    const handleLogout = async () => {
        try {
            await logout(tenant?.id || '');
            message.success('Logged out successfully');
            // Redirect to the staff login page using the current slug
            navigate(`/${slug || tenant?.subdomain || ''}/staff`);
        } catch (error) {
            message.error('Logout failed');
        }
    };

    // Determine the dashboard path based on role/subrole if needed, 
    // but typically it's just relative or absolute.
    // For now, assuming they are under /:slug/staff/...
    // We'll just route to the current path or a generic dashboard home.
    // Actually, the router structure is /:slug/staff/principal etc.
    // So the "Dashboard" link should probably point to /:slug/staff/dashboard or specific subrole path.
    // Implementation Plan said: "Sidebar: Single 'Dashboard' item."

    // We need to construct the link dynamically or just use the current path base?
    // The router has specific paths for roles: /principal, /teacher etc.
    // Let's check the Router again.
    // <Route path="dashboard" element={<StaffDashboard />} />
    // <Route path="principal" ... />

    // We should probably point to the root of their dashboard which seems to be dependent on their role.
    // However, for simplicity and ensuring it works for all staff, we can point to specific paths if we know them, 
    // or just 'dashboard' if that's the common one. 
    // Looking at TenantRouter.tsx:
    // path="dashboard" -> Accessible to all STAFF.
    // path="principal" -> Accessible to PRINCIPAL.

    // Let's use a smart getter for the dashboard link.
    const getDashboardPath = () => {
        const basePath = `/${slug || tenant?.subdomain}/staff`;
        if (user?.subRole === 'PRINCIPAL') return `${basePath}/principal`;
        if (user?.subRole === 'TEACHER') return `${basePath}/teacher`;
        if (user?.subRole === 'OFFICE_STAFF') return `${basePath}/office-staff`;
        if (user?.subRole === 'OFFICE_ASSISTANT') return `${basePath}/office-assistant`;
        return `${basePath}/dashboard`;
    };

    const menuItems = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
            onClick: () => navigate(getDashboardPath()),
        },
    ];

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: 'Profile',
                icon: <UserOutlined />,
            },
            {
                key: 'logout',
                label: 'Logout',
                icon: <LogoutOutlined />,
                danger: true,
                onClick: handleLogout,
            },
        ],
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider trigger={null} collapsible collapsed={collapsed} theme="light" width={250}>
                <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
                    {collapsed ? (
                        <div style={{ width: 32, height: 32, background: '#1890ff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                            {tenant?.name?.charAt(0) || 'S'}
                        </div>
                    ) : (
                        <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                            {tenant?.name || 'School System'}
                        </Title>
                    )}
                </div>
                <Menu
                    mode="inline"
                    // We can just highlight 'dashboard' always for now since it's the only item
                    selectedKeys={['dashboard']}
                    items={menuItems}
                    style={{ borderRight: 0 }}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)', zIndex: 1 }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{ fontSize: '16px', width: 64, height: 64 }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                            <Text strong>{user?.name}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>{user?.subRole || 'Staff'}</Text>
                        </div>
                        <Dropdown menu={userMenu} placement="bottomRight" arrow>
                            <Avatar style={{ backgroundColor: '#1890ff', cursor: 'pointer' }} icon={<UserOutlined />} />
                        </Dropdown>
                    </div>
                </Header>
                <Content
                    style={{
                        margin: '24px 16px',
                        padding: 24,
                        minHeight: 280,
                        background: '#fff',
                        borderRadius: '8px',
                        overflow: 'auto',
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};
