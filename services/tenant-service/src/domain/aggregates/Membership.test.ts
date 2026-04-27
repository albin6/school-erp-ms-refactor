import { describe, expect, it } from '@jest/globals';
import { Membership } from './Membership';

describe('Membership', () => {
    it('increments authzVersion when role or branch authorization changes', () => {
        const membership = new Membership({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: 'STAFF',
            subRole: 'TEACHER',
            branchId: 'branch-1',
            authzVersion: 3,
        });

        membership.updateRole('STAFF', 'PRINCIPAL', 'branch-2');

        expect(membership.authzVersion).toBe(4);
        expect(membership.subRole).toBe('PRINCIPAL');
        expect(membership.branchId).toBe('branch-2');
    });
});
