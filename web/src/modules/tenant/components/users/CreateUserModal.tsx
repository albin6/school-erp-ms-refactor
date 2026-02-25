import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { tenantUserService } from '@/services/tenantUserService';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';

interface CreateUserModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
    selectedBranchId?: string;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ open, onCancel, onSuccess, selectedBranchId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [role, setRole] = useState<string>('STUDENT');

    useEffect(() => {
        if (open) {
            fetchBranches();
            if (selectedBranchId) {
                form.setFieldsValue({ branch_id: selectedBranchId });
            }
        }
    }, [open, selectedBranchId]);

    const fetchBranches = async () => {
        try {
            const data = await branchService.getBranches({ limit: 100, status: 'ACTIVE' });
            setBranches(data.branches);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            await tenantUserService.createUser(values);
            message.success('User created successfully');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New User"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            forceRender
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: 'STUDENT', branch_id: selectedBranchId }}>
                { }
                <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, message: 'Please enter name' }]}
                >
                    <Input placeholder="John Doe" />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}
                >
                    <Input placeholder="user@school.com" />
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
                        rules={[{ required: true, message: 'Please select staff role' }]}
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
                    label="Assign to Branch"
                    rules={[{ required: true, message: 'Please select a branch' }]}
                >
                    <Select placeholder="Select branch" allowClear disabled={!!selectedBranchId}>
                        {(branches || []).map(branch => (
                            <Select.Option key={branch.id} value={branch.id}>{branch.name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};
