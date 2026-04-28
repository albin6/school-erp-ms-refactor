import { Router } from 'express';
import { requireAuth, requireTenantAccess } from '../middleware/auth.middleware';
import {
    assignClassTeacherController,
    assignSubjectTeacherController,
    assignSubjectToClassController,
    createAcademicYearController,
    createClassController,
    createSectionController,
    createSubjectController,
    createTermController,
    enrollStudentController,
    listAcademicYearsController,
    listClassesController,
    listEnrollmentsController,
    listSectionsController,
    listSubjectsController,
    listTermsController,
} from '../controllers/academic.controller';

const router = Router();
const tenantRouter = Router({ mergeParams: true });
const tenantAdminRouter = Router({ mergeParams: true });

router.use(requireAuth);
tenantRouter.use(requireTenantAccess());
tenantAdminRouter.use(requireTenantAccess(['ADMIN']));

tenantRouter.get('/academic-years', listAcademicYearsController);
tenantAdminRouter.post('/academic-years', createAcademicYearController);

tenantRouter.get('/terms', listTermsController);
tenantAdminRouter.post('/terms', createTermController);

tenantRouter.get('/classes', listClassesController);
tenantAdminRouter.post('/classes', createClassController);

tenantRouter.get('/sections', listSectionsController);
tenantAdminRouter.post('/sections', createSectionController);

tenantRouter.get('/subjects', listSubjectsController);
tenantAdminRouter.post('/subjects', createSubjectController);
tenantAdminRouter.post('/class-subjects', assignSubjectToClassController);

tenantRouter.get('/enrollments', listEnrollmentsController);
tenantAdminRouter.post('/enrollments', enrollStudentController);

tenantAdminRouter.post('/class-teachers', assignClassTeacherController);
tenantAdminRouter.post('/subject-teachers', assignSubjectTeacherController);

router.use('/tenants/:tenantId', tenantAdminRouter);
router.use('/tenants/:tenantId', tenantRouter);

export { router as academicRoutes };
