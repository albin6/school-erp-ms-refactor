import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, App } from 'antd';
import { branchService } from '@/services/branchService';
import type { Branch } from '@/services/branchService';

interface EditBranchModalProps {
    open: boolean;
    branch: Branch | null;
    onCancel: () => void;
    onSuccess: () => void;
}

export const EditBranchModal: React.FC<EditBranchModalProps> = ({ open, branch, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { message } = App.useApp();

    useEffect(() => {
        if (open && branch) {

            const timer = setTimeout(() => {
                form.setFieldsValue(branch);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [open, branch, form]);

    const handleSubmit = async (values: any) => {
        if (!branch) return;
        setLoading(true);
        try {
            await branchService.updateBranch(branch.id, values);
            message.success('Branch updated successfully');
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to update branch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Branch"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            destroyOnHidden={true}
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit} preserve={false}>
                <Form.Item
                    name="name"
                    label="Branch Name"
                    rules={[{ required: true, message: 'Please enter branch name' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="slug"
                    label="URL Slug"
                    rules={[
                        { required: true, message: 'Please enter a URL slug' },
                        { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Only lowercase letters, numbers, and hyphens allowed' },
                        {
                            validator: async (_, value) => {
                                if (!value || value === branch?.slug) return Promise.resolve();
                                const isAvailable = await branchService.checkSlugAvailability(value);
                                if (!isAvailable) {
                                    return Promise.reject(new Error('This slug is already taken'));
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
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
                    name="address"
                    label="Address"
                >
                    <Input.TextArea rows={2} />
                </Form.Item>

                <Form.Item
                    name="phone"
                    label="Phone Number"
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Branch Email"
                    rules={[{ type: 'email' }]}
                >
                    <Input />
                </Form.Item>
            </Form>
        </Modal>
    );
};
