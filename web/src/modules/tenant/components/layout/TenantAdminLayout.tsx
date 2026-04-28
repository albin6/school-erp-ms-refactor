import { useState } from 'react';
import { Layout, Menu, Button, Typography, Dropdown, Avatar, App } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    TeamOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SettingOutlined,
    BankOutlined,
    BookOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTenantAuthStore } from '@/store/tenantAuthStore';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export const TenantAdminLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, tenant, user } = useTenantAuthStore();
    const { message } = App.useApp();

    const handleLogout = async () => {
        try {
            await logout(tenant?.id || '');
            message.success('Logged out successfully');
            navigate('/admin');
        } catch (error) {
            message.error('Logout failed');
        }
    };

    const menuItems = [
        {
            key: '/admin/dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
            onClick: () => navigate('/admin/dashboard'),
        },
        {
            key: '/admin/branches',
            icon: <BankOutlined />,
            label: 'Branches',
            onClick: () => navigate('/admin/branches'),
        },
        {
            key: '/admin/academic',
            icon: <BookOutlined />,
            label: 'Academic',
            onClick: () => navigate('/admin/academic'),
        },
        {
            key: '/admin/users',
            icon: <TeamOutlined />,
            label: 'Users',
            onClick: () => navigate('/admin/users'),
        },
        {
            key: '/admin/students',
            icon: <UserOutlined />,
            label: 'Students',
            onClick: () => navigate('/admin/students'),
        },
        {
            key: '/admin/staff',
            icon: <TeamOutlined />,
            label: 'Staff',
            onClick: () => navigate('/admin/staff'),
        },
        {
            key: '/admin/settings',
            icon: <SettingOutlined />,
            label: 'Settings',
            onClick: () => navigate('/admin/settings'),
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
                    selectedKeys={[location.pathname]}
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
                        <Text strong>{user?.name}</Text>
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
