import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    App,
    Button,
    Card,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Modal,
    Select,
    Space,
    Table,
    Tabs,
    Tag,
    Typography,
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import { BookOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { academicService } from '@/services/academicService';
import type { AcademicClass, AcademicYear, Enrollment, Section, Subject } from '@/services/academicService';
import { tenantUserService } from '@/services/tenantUserService';
import type { TenantUser } from '@/services/tenantUserService';

const { Title, Text } = Typography;

const getErrorMessage = (error: any, fallback: string) =>
    error?.response?.data?.error || error?.response?.data?.message || fallback;

const usePagedState = <T,>() => {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    return { items, setItems, loading, setLoading, pagination, setPagination };
};

export const AcademicManagement = () => {
    const { message } = App.useApp();
    const [activeTab, setActiveTab] = useState('years');
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [classes, setClasses] = useState<AcademicClass[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [sectionsByClass, setSectionsByClass] = useState<Record<string, Section[]>>({});
    const [staff, setStaff] = useState<TenantUser[]>([]);
    const [students, setStudents] = useState<TenantUser[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>();

    const yearState = usePagedState<AcademicYear>();
    const classState = usePagedState<AcademicClass>();
    const subjectState = usePagedState<Subject>();
    const enrollmentState = usePagedState<Enrollment>();

    const [yearOpen, setYearOpen] = useState(false);
    const [termOpen, setTermOpen] = useState(false);
    const [classOpen, setClassOpen] = useState(false);
    const [sectionOpen, setSectionOpen] = useState(false);
    const [subjectOpen, setSubjectOpen] = useState(false);
    const [classSubjectOpen, setClassSubjectOpen] = useState(false);
    const [enrollmentOpen, setEnrollmentOpen] = useState(false);
    const [classTeacherOpen, setClassTeacherOpen] = useState(false);
    const [subjectTeacherOpen, setSubjectTeacherOpen] = useState(false);

    const [yearForm] = Form.useForm();
    const [termForm] = Form.useForm();
    const [classForm] = Form.useForm();
    const [sectionForm] = Form.useForm();
    const [subjectForm] = Form.useForm();
    const [classSubjectForm] = Form.useForm();
    const [enrollmentForm] = Form.useForm();
    const [classTeacherForm] = Form.useForm();
    const [subjectTeacherForm] = Form.useForm();

    const fetchYears = useCallback(async (page = yearState.pagination.current, limit = yearState.pagination.pageSize) => {
        yearState.setLoading(true);
        try {
            const result = await academicService.getAcademicYears({ page, limit });
            yearState.setItems(result.items);
            setYears(result.items);
            yearState.setPagination({ current: result.pagination.page, pageSize: result.pagination.limit, total: result.pagination.total });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load academic years'));
        } finally {
            yearState.setLoading(false);
        }
    }, [message, yearState]);

    const fetchClasses = useCallback(async (page = classState.pagination.current, limit = classState.pagination.pageSize) => {
        classState.setLoading(true);
        try {
            const result = await academicService.getClasses({ page, limit });
            classState.setItems(result.items);
            setClasses(result.items);
            classState.setPagination({ current: result.pagination.page, pageSize: result.pagination.limit, total: result.pagination.total });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load classes'));
        } finally {
            classState.setLoading(false);
        }
    }, [classState, message]);

    const fetchSubjects = useCallback(async (page = subjectState.pagination.current, limit = subjectState.pagination.pageSize) => {
        subjectState.setLoading(true);
        try {
            const result = await academicService.getSubjects({ page, limit });
            subjectState.setItems(result.items);
            setSubjects(result.items);
            subjectState.setPagination({ current: result.pagination.page, pageSize: result.pagination.limit, total: result.pagination.total });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load subjects'));
        } finally {
            subjectState.setLoading(false);
        }
    }, [message, subjectState]);

    const fetchEnrollments = useCallback(async (page = enrollmentState.pagination.current, limit = enrollmentState.pagination.pageSize) => {
        enrollmentState.setLoading(true);
        try {
            const result = await academicService.getEnrollments({ page, limit });
            enrollmentState.setItems(result.items);
            enrollmentState.setPagination({ current: result.pagination.page, pageSize: result.pagination.limit, total: result.pagination.total });
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load enrollments'));
        } finally {
            enrollmentState.setLoading(false);
        }
    }, [enrollmentState, message]);

    const fetchUsers = useCallback(async () => {
        try {
            const [staffResult, studentResult] = await Promise.all([
                tenantUserService.getUsers({ role: 'STAFF', limit: 100 }),
                tenantUserService.getUsers({ role: 'STUDENT', limit: 100 }),
            ]);
            setStaff(staffResult.data.users);
            setStudents(studentResult.data.users);
        } catch {
            message.warning('Academic forms loaded, but users could not be preloaded');
        }
    }, [message]);

    useEffect(() => {
        void fetchYears(1);
        void fetchClasses(1);
        void fetchSubjects(1);
        void fetchEnrollments(1);
        void fetchUsers();
    }, []);

    const yearOptions = useMemo(() => years.map((year) => ({ label: year.name, value: year.id })), [years]);
    const classOptions = useMemo(() => classes.map((item) => ({ label: item.name, value: item.id })), [classes]);
    const subjectOptions = useMemo(() => subjects.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })), [subjects]);
    const staffOptions = useMemo(() => staff.map((item) => ({ label: `${item.user.name} (${item.sub_role ?? item.role})`, value: item.user_id })), [staff]);
    const studentOptions = useMemo(() => students.map((item) => ({ label: item.user.name, value: item.user_id })), [students]);
    const sectionOptions = useMemo(() => {
        const sections = selectedClassId ? sectionsByClass[selectedClassId] ?? [] : [];
        return sections.map((section) => ({ label: section.name, value: section.id }));
    }, [sectionsByClass, selectedClassId]);

    const loadSections = async (classId: string) => {
        setSelectedClassId(classId);
        if (sectionsByClass[classId]) return;
        try {
            const sections = await academicService.getSections(classId);
            setSectionsByClass((prev) => ({ ...prev, [classId]: sections }));
        } catch (error) {
            message.error(getErrorMessage(error, 'Failed to load sections'));
        }
    };

    const submitModal = async (form: any, close: () => void, action: (values: any) => Promise<any>, refresh: () => void) => {
        try {
            const values = await form.validateFields();
            await action(values);
            message.success('Saved successfully');
            form.resetFields();
            close();
            refresh();
        } catch (error: any) {
            if (!error?.errorFields) {
                message.error(getErrorMessage(error, 'Save failed'));
            }
        }
    };

    const tablePagination = (state: ReturnType<typeof usePagedState<any>>, reload: (page: number, limit: number) => void): TablePaginationConfig => ({
        current: state.pagination.current,
        pageSize: state.pagination.pageSize,
        total: state.pagination.total,
        showSizeChanger: true,
        onChange: reload,
    });

    return (
        <div className="p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <BookOutlined className="text-2xl text-indigo-600" />
                        <Title level={2} style={{ margin: 0 }}>Academic Management</Title>
                    </div>
                    <Text type="secondary">Configure academic years, classes, subjects, enrollments, and teacher assignments.</Text>
                </div>
                <Space wrap>
                    <Button icon={<PlusOutlined />} onClick={() => setYearOpen(true)}>Academic Year</Button>
                    <Button type="primary" icon={<TeamOutlined />} onClick={() => setEnrollmentOpen(true)}>Enroll Student</Button>
                </Space>
            </div>

            <Card variant="borderless" className="shadow-xs">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'years',
                            label: 'Years & Terms',
                            children: (
                                <Space direction="vertical" size="middle" className="w-full">
                                    <Space wrap>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setYearOpen(true)}>Add Year</Button>
                                        <Button icon={<PlusOutlined />} onClick={() => setTermOpen(true)} disabled={years.length === 0}>Add Term</Button>
                                    </Space>
                                    <Table
                                        rowKey="id"
                                        loading={yearState.loading}
                                        dataSource={yearState.items}
                                        pagination={tablePagination(yearState, fetchYears)}
                                        columns={[
                                            { title: 'Name', dataIndex: 'name' },
                                            { title: 'Start', dataIndex: 'starts_on' },
                                            { title: 'End', dataIndex: 'ends_on' },
                                            { title: 'Status', dataIndex: 'status', render: (status) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status}</Tag> },
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'classes',
                            label: 'Classes & Sections',
                            children: (
                                <Space direction="vertical" size="middle" className="w-full">
                                    <Space wrap>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setClassOpen(true)}>Add Class</Button>
                                        <Button icon={<PlusOutlined />} onClick={() => setSectionOpen(true)} disabled={classes.length === 0}>Add Section</Button>
                                    </Space>
                                    <Table
                                        rowKey="id"
                                        loading={classState.loading}
                                        dataSource={classState.items}
                                        pagination={tablePagination(classState, fetchClasses)}
                                        expandable={{
                                            onExpand: (expanded, record) => expanded && void loadSections(record.id),
                                            expandedRowRender: (record) => (
                                                <Table
                                                    size="small"
                                                    rowKey="id"
                                                    pagination={false}
                                                    dataSource={sectionsByClass[record.id] ?? []}
                                                    columns={[
                                                        { title: 'Section', dataIndex: 'name' },
                                                        { title: 'Capacity', dataIndex: 'capacity', render: (value) => value ?? '-' },
                                                        { title: 'Status', dataIndex: 'status' },
                                                    ]}
                                                />
                                            ),
                                        }}
                                        columns={[
                                            { title: 'Class', dataIndex: 'name' },
                                            { title: 'Sort', dataIndex: 'sort_order' },
                                            { title: 'Status', dataIndex: 'status', render: (status) => <Tag color="blue">{status}</Tag> },
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'subjects',
                            label: 'Subjects',
                            children: (
                                <Space direction="vertical" size="middle" className="w-full">
                                    <Space wrap>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setSubjectOpen(true)}>Add Subject</Button>
                                        <Button icon={<PlusOutlined />} onClick={() => setClassSubjectOpen(true)} disabled={!classes.length || !subjects.length}>Assign To Class</Button>
                                    </Space>
                                    <Table
                                        rowKey="id"
                                        loading={subjectState.loading}
                                        dataSource={subjectState.items}
                                        pagination={tablePagination(subjectState, fetchSubjects)}
                                        columns={[
                                            { title: 'Code', dataIndex: 'code' },
                                            { title: 'Subject', dataIndex: 'name' },
                                            { title: 'Status', dataIndex: 'status', render: (status) => <Tag color="cyan">{status}</Tag> },
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'enrollments',
                            label: 'Enrollments',
                            children: (
                                <Space direction="vertical" size="middle" className="w-full">
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setEnrollmentOpen(true)}>Enroll Student</Button>
                                    <Table
                                        rowKey="id"
                                        loading={enrollmentState.loading}
                                        dataSource={enrollmentState.items}
                                        pagination={tablePagination(enrollmentState, fetchEnrollments)}
                                        columns={[
                                            { title: 'Student User ID', dataIndex: 'student_user_id', ellipsis: true },
                                            { title: 'Class', dataIndex: 'class_name' },
                                            { title: 'Section', dataIndex: 'section_name' },
                                            { title: 'Roll No.', dataIndex: 'roll_number', render: (value) => value ?? '-' },
                                            { title: 'Status', dataIndex: 'status', render: (status) => <Tag color="green">{status}</Tag> },
                                        ]}
                                    />
                                </Space>
                            ),
                        },
                        {
                            key: 'teachers',
                            label: 'Teacher Assignments',
                            children: (
                                <Space wrap>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setClassTeacherOpen(true)}>Assign Class Teacher</Button>
                                    <Button icon={<PlusOutlined />} onClick={() => setSubjectTeacherOpen(true)}>Assign Subject Teacher</Button>
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>

            <Modal title="Create Academic Year" open={yearOpen} onCancel={() => setYearOpen(false)} onOk={() => submitModal(yearForm, () => setYearOpen(false), (values) => academicService.createAcademicYear({
                ...values,
                starts_on: values.date_range[0].format('YYYY-MM-DD'),
                ends_on: values.date_range[1].format('YYYY-MM-DD'),
            }), () => fetchYears(1))} destroyOnHidden>
                <Form form={yearForm} layout="vertical" initialValues={{ status: 'ACTIVE' }}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="2026-2027" /></Form.Item>
                    <Form.Item name="date_range" label="Date Range" rules={[{ required: true }]}><DatePicker.RangePicker className="w-full" /></Form.Item>
                    <Form.Item name="status" label="Status"><Select options={['DRAFT', 'ACTIVE', 'ARCHIVED'].map((value) => ({ label: value, value }))} /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Create Term" open={termOpen} onCancel={() => setTermOpen(false)} onOk={() => submitModal(termForm, () => setTermOpen(false), (values) => academicService.createTerm({
                academic_year_id: values.academic_year_id,
                name: values.name,
                starts_on: values.date_range[0].format('YYYY-MM-DD'),
                ends_on: values.date_range[1].format('YYYY-MM-DD'),
            }), () => undefined)} destroyOnHidden>
                <Form form={termForm} layout="vertical">
                    <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}><Select options={yearOptions} /></Form.Item>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input placeholder="Term 1" /></Form.Item>
                    <Form.Item name="date_range" label="Date Range" rules={[{ required: true }]}><DatePicker.RangePicker className="w-full" /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Create Class" open={classOpen} onCancel={() => setClassOpen(false)} onOk={() => submitModal(classForm, () => setClassOpen(false), academicService.createClass, () => fetchClasses(1))} destroyOnHidden>
                <Form form={classForm} layout="vertical">
                    <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}><Select options={yearOptions} /></Form.Item>
                    <Form.Item name="name" label="Class Name" rules={[{ required: true }]}><Input placeholder="Grade 1" /></Form.Item>
                    <Form.Item name="sort_order" label="Sort Order"><InputNumber min={0} className="w-full" /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Create Section" open={sectionOpen} onCancel={() => setSectionOpen(false)} onOk={() => submitModal(sectionForm, () => setSectionOpen(false), academicService.createSection, () => {
                setSectionsByClass({});
                fetchClasses();
            })} destroyOnHidden>
                <Form form={sectionForm} layout="vertical">
                    <Form.Item name="class_id" label="Class" rules={[{ required: true }]}><Select options={classOptions} /></Form.Item>
                    <Form.Item name="name" label="Section Name" rules={[{ required: true }]}><Input placeholder="A" /></Form.Item>
                    <Form.Item name="capacity" label="Capacity"><InputNumber min={1} className="w-full" /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Create Subject" open={subjectOpen} onCancel={() => setSubjectOpen(false)} onOk={() => submitModal(subjectForm, () => setSubjectOpen(false), academicService.createSubject, () => fetchSubjects(1))} destroyOnHidden>
                <Form form={subjectForm} layout="vertical">
                    <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input placeholder="MATH" /></Form.Item>
                    <Form.Item name="name" label="Subject Name" rules={[{ required: true }]}><Input placeholder="Mathematics" /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Assign Subject To Class" open={classSubjectOpen} onCancel={() => setClassSubjectOpen(false)} onOk={() => submitModal(classSubjectForm, () => setClassSubjectOpen(false), academicService.assignSubjectToClass, () => undefined)} destroyOnHidden>
                <Form form={classSubjectForm} layout="vertical" initialValues={{ is_mandatory: true }}>
                    <Form.Item name="class_id" label="Class" rules={[{ required: true }]}><Select options={classOptions} /></Form.Item>
                    <Form.Item name="subject_id" label="Subject" rules={[{ required: true }]}><Select options={subjectOptions} /></Form.Item>
                    <Form.Item name="is_mandatory" label="Type"><Select options={[{ label: 'Mandatory', value: true }, { label: 'Optional', value: false }]} /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Enroll Student" open={enrollmentOpen} onCancel={() => setEnrollmentOpen(false)} onOk={() => submitModal(enrollmentForm, () => setEnrollmentOpen(false), academicService.enrollStudent, () => fetchEnrollments(1))} destroyOnHidden>
                <Form form={enrollmentForm} layout="vertical">
                    <Form.Item name="student_user_id" label="Student" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={studentOptions} /></Form.Item>
                    <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}><Select options={yearOptions} /></Form.Item>
                    <Form.Item name="class_id" label="Class" rules={[{ required: true }]}>
                        <Select options={classOptions} onChange={(value) => {
                            enrollmentForm.setFieldValue('section_id', undefined);
                            void loadSections(value);
                        }} />
                    </Form.Item>
                    <Form.Item name="section_id" label="Section" rules={[{ required: true }]}><Select options={sectionOptions} /></Form.Item>
                    <Form.Item name="roll_number" label="Roll Number"><Input /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Assign Class Teacher" open={classTeacherOpen} onCancel={() => setClassTeacherOpen(false)} onOk={() => submitModal(classTeacherForm, () => setClassTeacherOpen(false), academicService.assignClassTeacher, () => undefined)} destroyOnHidden>
                <Form form={classTeacherForm} layout="vertical">
                    <Form.Item name="teacher_user_id" label="Teacher" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={staffOptions} /></Form.Item>
                    <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}><Select options={yearOptions} /></Form.Item>
                    <Form.Item name="class_id" label="Class" rules={[{ required: true }]}>
                        <Select options={classOptions} onChange={(value) => {
                            classTeacherForm.setFieldValue('section_id', undefined);
                            void loadSections(value);
                        }} />
                    </Form.Item>
                    <Form.Item name="section_id" label="Section" rules={[{ required: true }]}><Select options={sectionOptions} /></Form.Item>
                </Form>
            </Modal>

            <Modal title="Assign Subject Teacher" open={subjectTeacherOpen} onCancel={() => setSubjectTeacherOpen(false)} onOk={() => submitModal(subjectTeacherForm, () => setSubjectTeacherOpen(false), academicService.assignSubjectTeacher, () => undefined)} destroyOnHidden>
                <Form form={subjectTeacherForm} layout="vertical">
                    <Form.Item name="teacher_user_id" label="Teacher" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={staffOptions} /></Form.Item>
                    <Form.Item name="academic_year_id" label="Academic Year" rules={[{ required: true }]}><Select options={yearOptions} /></Form.Item>
                    <Form.Item name="class_id" label="Class" rules={[{ required: true }]}>
                        <Select options={classOptions} onChange={(value) => {
                            subjectTeacherForm.setFieldValue('section_id', undefined);
                            void loadSections(value);
                        }} />
                    </Form.Item>
                    <Form.Item name="section_id" label="Section"><Select allowClear options={sectionOptions} /></Form.Item>
                    <Form.Item name="subject_id" label="Subject" rules={[{ required: true }]}><Select options={subjectOptions} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
