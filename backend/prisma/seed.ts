import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const roles = [
        { email: 'admin@campus.edu', password: 'adminpassword', name: 'Dr. Rajesh Kumar', role: 'Admin' },
        { email: 'lab@campus.edu', password: 'labpassword', name: 'Lab Manager', role: 'LabIncharge' },
        { email: 'service@campus.edu', password: 'servicepassword', name: 'Service Engineer', role: 'Service' },
    ];

    for (const user of roles) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        await (prisma as any).user.upsert({
            where: { email: user.email },
            update: {},
            create: {
                email: user.email,
                password: hashedPassword,
                name: user.name,
                role: user.role as any,
            },
        });
        console.log(`Seeded user: ${user.email}`);
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
