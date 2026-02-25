import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { tenantUserService } from '@/services/tenantUserService';
import type { TenantUser } from '@/services/tenantUserService';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';

interface EditUserModalProps {
    open: boolean;
    user: TenantUser | null;
    onCancel: () => void;
    onSuccess: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ open, user, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [role, setRole] = useState<string>('STUDENT');

    useEffect(() => {
        if (open && user) {
            console.log('Populating Edit Form:', user);
            form.resetFields();
            form.setFieldsValue({
                name: user.user.name,
                email: user.user.email,
                role: user.role,
                sub_role: user.sub_role,
                branch_id: user.branch_id,
                status: user.user.is_active ? 'ACTIVE' : 'BLOCKED'
            });
            setRole(user.role);
            
            fetchBranches();
        }
    }, [open, user, form]);

    const fetchBranches = async () => {
        try {
            const data = await branchService.getBranches({ limit: 100, status: 'ACTIVE' });
            
            const branchesData = data.branches || [];
            setBranches(Array.isArray(branchesData) ? branchesData : []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (values: any) => {
        if (!user) return;
        setLoading(true);
        try {
            await tenantUserService.updateUser(user.user_id, values);
            message.success('User updated successfully');
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit User"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            destroyOnHidden={true}
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: 'email' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="status"
                    label="Status"
                    rules={[{ required: true }]}
                >
                    <Select>
                        <Select.Option value="ACTIVE">Active</Select.Option>
                        <Select.Option value="BLOCKED">Blocked</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="role"
                    label="Role"
                    rules={[{ required: true }]}
                >
                    <Select onChange={setRole}>
                        <Select.Option value="STUDENT">Student</Select.Option>
                        <Select.Option value="STAFF">Staff</Select.Option>
                    </Select>
                </Form.Item>

                {role === 'STAFF' && (
                    <Form.Item
                        name="sub_role"
                        label="Staff Role"
                    >
                        <Select placeholder="Select position">
                            <Select.Option value="TEACHER">Teacher</Select.Option>
                            <Select.Option value="PRINCIPAL">Principal</Select.Option>
                            <Select.Option value="OFFICE_STAFF">Office Staff</Select.Option>
                            <Select.Option value="OFFICE_ASSISTANT">Office Assistant</Select.Option>
                        </Select>
                    </Form.Item>
                )}

                <Form.Item
                    name="branch_id"
                    label="Branch"
                >
                    <Select placeholder="Select branch" allowClear>
                        {branches.map(branch => (
                            <Select.Option key={branch.id} value={branch.id}>{branch.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};
