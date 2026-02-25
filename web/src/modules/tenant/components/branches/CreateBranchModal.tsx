import React, { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { branchService } from '@/services/branchService';

interface CreateBranchModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({ open, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { message } = App.useApp();

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            await branchService.createBranch(values);
            message.success('Branch created successfully');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to create branch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Add New School Branch"
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="name"
                    label="Branch Name"
                    rules={[{ required: true, message: 'Please enter branch name' }]}
                >
                    <Input
                        placeholder="Main Campus"
                        onChange={(e) => {
                            const name = e.target.value;
                            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            form.setFieldsValue({ slug });
                        }}
                    />
                </Form.Item>

                <Form.Item
                    name="slug"
                    label="URL Slug"
                    rules={[
                        { required: true, message: 'Please enter a URL slug' },
                        { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Only lowercase letters, numbers, and hyphens allowed' },
                        {
                            validator: async (_, value) => {
                                if (!value) return Promise.resolve();
                                const isAvailable = await branchService.checkSlugAvailability(value);
                                if (!isAvailable) {
                                    return Promise.reject(new Error('This slug is already taken'));
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
                    tooltip="This will be used in the URL: domain.com/slug"
                >
                    <Input placeholder="main-campus" />
                </Form.Item>

                <Form.Item
                    name="address"
                    label="Address"
                >
                    <Input.TextArea placeholder="123 School St..." rows={2} />
                </Form.Item>

                <Form.Item
                    name="phone"
                    label="Phone Number"
                >
                    <Input placeholder="+1 234 567 8900" />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Branch Email"
                    rules={[{ type: 'email', message: 'Invalid email' }]}
                >
                    <Input placeholder="branch@school.com" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
