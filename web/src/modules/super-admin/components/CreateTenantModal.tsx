import { Modal, Form, Input, message } from 'antd';
import { useState, useRef } from 'react';
import { tenantService } from '../services/tenant.service';
import type { CreateTenantDTO } from '../types/tenant.types';
import { config } from '@/config';

interface CreateTenantModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateTenantModal = ({ open, onClose, onSuccess }: CreateTenantModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<any>(null);

    const handleSubmit = async (values: CreateTenantDTO) => {
        setLoading(true);
        try {
            await tenantService.createTenant(values);
            message.success('Tenant created successfully');
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to create tenant');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const checkSubdomain = async (_: any, value: string) => {
        if (!value || value.length < 3) return Promise.resolve();

        return new Promise((resolve, reject) => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(async () => {
                try {
                    const response = await tenantService.checkAvailability(value);
                    if (response.data.available) {
                        resolve(null);
                    } else {
                        reject(new Error('Subdomain is already taken'));
                    }
                } catch (error) {

                    console.error('Check failed', error);
                    resolve(null);
                }
            }, 500);
        });
    };

    return (
        <Modal
            title="Create New Tenant"
            open={open}
            onCancel={handleCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                <Form.Item
                    label="School Name"
                    name="name"
                    rules={[
                        { required: true, message: 'Please enter school name' },
                        { min: 3, message: 'Name must be at least 3 characters' },
                    ]}
                >
                    <Input placeholder="e.g., Greenwood High School" />
                </Form.Item>

                <Form.Item
                    label="Subdomain"
                    name="subdomain"
                    hasFeedback
                    rules={[
                        { required: true, message: 'Please enter subdomain' },
                        { min: 3, message: 'Subdomain must be at least 3 characters' },
                        { max: 63, message: 'Subdomain must be less than 63 characters' },
                        {
                            pattern: /^[a-z0-9-]+$/,
                            message: 'Subdomain must contain only lowercase letters, numbers, and hyphens',
                        },
                        { validator: checkSubdomain }
                    ]}
                    extra={`This will be used as: subdomain.${config.ROOT_DOMAIN}`}
                >
                    <Input placeholder="e.g., greenwood" />
                </Form.Item>

                <Form.Item
                    label="Admin Email"
                    name="admin_email"
                    rules={[
                        { required: true, message: 'Please enter admin email' },
                        { type: 'email', message: 'Please enter a valid email' },
                    ]}
                    extra="Temporary credentials will be sent to this email"
                >
                    <Input placeholder="e.g., admin@greenwood.edu" />
                </Form.Item>

                <Form.Item
                    label="Custom Domain (Optional)"
                    name="domain"
                >
                    <Input placeholder="e.g., greenwood.edu" />
                </Form.Item>
            </Form >
        </Modal >
    );
};
