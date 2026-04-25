import React, { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Button, App, Spin } from 'antd';
import {
    UserOutlined,
    TeamOutlined,
    BookOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { useTenantAuthStore } from '../../../store/tenantAuthStore';
import api from '../../../services/api';

interface DashboardStats {
    totalStudents: number;
    totalStaff: number;
    totalAdmins: number;
    totalUsers: number;
    activeUsers: number;
    recentEnrollments: number;
}

interface Activity {
    id: string;
    action: string;
    resource: string;
    user: {
        id: string;
        name: string;
        email: string;
    } | null;
    timestamp: string;
    ipAddress: string;
}

const TenantAdminDashboard: React.FC = () => {
    const { user, tenant } = useTenantAuthStore();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const { message } = App.useApp();

    const fetchDashboardData = useCallback(async () => {
        if (!tenant) return;

        try {
            setLoading(true);

            const statsResponse = await api.get(`/tenants/${tenant.id}/dashboard/stats`);
            setStats(statsResponse.data.data);

            const activitiesResponse = await api.get(`/tenants/${tenant.id}/dashboard/activities?limit=10`);
            setActivities(activitiesResponse.data.data);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [tenant, message]);

    useEffect(() => {
        if (!tenant) return;
        fetchDashboardData();
    }, [tenant, fetchDashboardData]);

    const activityColumns = [
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: (action: string) => (
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {action.replace('_', ' ')}
                </span>
            ),
        },
        {
            title: 'User',
            dataIndex: 'user',
            key: 'user',
            render: (user: Activity['user']) => user ? user.name : 'System',
        },
        {
            title: 'Resource',
            dataIndex: 'resource',
            key: 'resource',
        },
        {
            title: 'Time',
            dataIndex: 'timestamp',
            key: 'timestamp',
            render: (timestamp: string) => new Date(timestamp).toLocaleString(),
        },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            { }
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                        Dashboard Overview
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                        Welcome back, {user?.name}
                    </p>
                </div>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchDashboardData}
                >
                    Refresh
                </Button>
            </div>

            { }
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Total Students"
                            value={stats?.totalStudents || 0}
                            prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                            styles={{ content: { color: '#1890ff' } }}
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            {stats?.recentEnrollments || 0} enrolled this month
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Total Staff"
                            value={stats?.totalStaff || 0}
                            prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                            styles={{ content: { color: '#52c41a' } }}
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            Active members
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Total Users"
                            value={stats?.totalUsers || 0}
                            prefix={<BookOutlined style={{ color: '#faad14' }} />}
                            styles={{ content: { color: '#faad14' } }}
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            All system users
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Active Users"
                            value={stats?.activeUsers || 0}
                            prefix={<UserOutlined style={{ color: '#722ed1' }} />}
                            styles={{ content: { color: '#722ed1' } }}
                        />
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            Last 7 days
                        </div>
                    </Card>
                </Col>
            </Row>

            { }
            <Card
                title="Recent Activities"
                variant="borderless"
                style={{ borderRadius: '8px' }}
            >
                <Table
                    columns={activityColumns}
                    dataSource={activities}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'No recent activities' }}
                />
            </Card>
        </div>
    );
};

export default TenantAdminDashboard;
