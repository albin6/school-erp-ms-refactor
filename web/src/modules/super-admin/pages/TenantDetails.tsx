import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Descriptions, Tag, Spin, message, Tabs } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { tenantService } from '../services/tenant.service';
import { BranchList } from '../components/BranchList';
import { TenantUserList } from '../components/TenantUserList';
import { EditTenantModal } from '../components/EditTenantModal';
import type { Tenant } from '../types/tenant.types';
import { config } from '@/config';


export const TenantDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<any | null>(null);


    useEffect(() => {
        if (id) {
            fetchTenantDetails();
        }
    }, [id]);

    const fetchTenantDetails = async () => {
        try {
            const response = await tenantService.getTenantById(id!);
            setTenant(response.data.tenant);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to fetch tenant details');
            navigate('/tenants');
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Spin size="large" />
            </div>
        );
    }

    if (!tenant) {
        return null;
    }

    return (
        <div>
            <div className="mb-6">
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/tenants')}
                    className="mb-4"
                >
                    Back to Tenants
                </Button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
                        <p className="text-gray-600 mt-1">Tenant Details</p>
                    </div>
                    <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => setEditModalOpen(true)}
                    >
                        Edit Tenant
                    </Button>
                </div>
            </div>

            <Tabs
                defaultActiveKey="details"
                items={[
                    {
                        key: 'details',
                        label: 'Details',
                        children: (
                            <Card>
                                <Descriptions bordered column={2}>
                                    <Descriptions.Item label="School Name">
                                        {tenant.name}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Status">
                                        <Tag color={tenant.status === 'ACTIVE' ? 'green' : 'red'}>
                                            {tenant.status}
                                        </Tag>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Subdomain">
                                        <code className="bg-gray-100 px-2 py-1 rounded">
                                            {tenant.subdomain}.{config.ROOT_DOMAIN}
                                        </code>
                                    </Descriptions.Item>

                                    <Descriptions.Item label="Custom Domain">
                                        {tenant.domain || '-'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Created At">
                                        {new Date(tenant.created_at).toLocaleString()}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Updated At">
                                        {new Date(tenant.updated_at).toLocaleString()}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Active" span={2}>
                                        <Tag color={tenant.is_active ? 'green' : 'red'}>
                                            {tenant.is_active ? 'Yes' : 'No'}
                                        </Tag>
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        ),
                    },
                    {
                        key: 'users',
                        label: 'Users',
                        children: selectedBranch ? (
                            <TenantUserList
                                tenantId={id!}
                                branchId={selectedBranch.id}
                                branchName={selectedBranch.name}
                                onBack={() => setSelectedBranch(null)}
                            />
                        ) : (
                            <BranchList
                                tenantId={id!}
                                onSelectBranch={setSelectedBranch}
                            />
                        ),
                    },
                ]}
            />

            <EditTenantModal
                open={editModalOpen}
                tenant={tenant}
                onClose={() => setEditModalOpen(false)}
                onSuccess={fetchTenantDetails}
            />
        </div>
    );
};
