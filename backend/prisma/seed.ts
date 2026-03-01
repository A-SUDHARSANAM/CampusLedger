import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const users = [
        {
            email: 'admin@campus.edu',
            password: 'adminpassword',
            name: 'Dr. Rajesh Kumar',
            role: 'Admin',
            profile: { employeeId: 'ADM-001', department: 'Administration', supervisor: 'Board of Governors' }
        },
        {
            email: 'lab@campus.edu',
            password: 'labpassword',
            name: 'Lab Manager',
            role: 'LabIncharge',
            profile: { employeeId: 'LAB-102', labName: 'Cyber-Physical Systems Lab', department: 'Computer Science' }
        },
        {
            email: 'service@campus.edu',
            password: 'servicepassword',
            name: 'Service Engineer',
            role: 'Service',
            profile: { employeeId: 'SRV-505', specialization: 'Network Infrastructure', region: 'North Wing' }
        },
    ];

    for (const data of users) {
        const hashedPassword = await bcrypt.hash(data.password, 12);

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.upsert({
                where: { email: data.email },
                update: {},
                create: {
                    email: data.email,
                    password: hashedPassword,
                    name: data.name,
                    role: data.role as any,
                },
            });

            if (data.role === 'Admin') {
                await tx.adminProfile.upsert({
                    where: { employeeId: data.profile.employeeId },
                    update: {},
                    create: { ...data.profile, userId: user.id } as any
                });
            } else if (data.role === 'LabIncharge') {
                await tx.labInchargeProfile.upsert({
                    where: { employeeId: data.profile.employeeId },
                    update: {},
                    create: { ...data.profile, userId: user.id } as any
                });
            } else if (data.role === 'Service') {
                await tx.serviceProfile.upsert({
                    where: { employeeId: data.profile.employeeId },
                    update: {},
                    create: { ...data.profile, userId: user.id } as any
                });
            }
        });

        console.log(`Seeded user and profile: ${data.email}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
