import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                adminProfile: true,
                labInchargeProfile: true,
                serviceProfile: true,
            }
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                profile: user.adminProfile || user.labInchargeProfile || user.serviceProfile
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role, profileData } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Transaction to create user and profile
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role,
                },
            });

            // Create role-specific profile
            if (role === 'Admin') {
                await tx.adminProfile.create({
                    data: {
                        employeeId: profileData?.employeeId || `ADM-${Date.now()}`,
                        department: profileData?.department || 'Administration',
                        supervisor: profileData?.supervisor || 'System',
                        userId: user.id
                    }
                });
            } else if (role === 'LabIncharge') {
                await tx.labInchargeProfile.create({
                    data: {
                        employeeId: profileData?.employeeId || `LAB-${Date.now()}`,
                        labName: profileData?.labName || 'Main Campus Lab',
                        department: profileData?.department || 'Science',
                        userId: user.id
                    }
                });
            } else if (role === 'Service') {
                await tx.serviceProfile.create({
                    data: {
                        employeeId: profileData?.employeeId || `SRV-${Date.now()}`,
                        specialization: profileData?.specialization || 'General Maintenance',
                        region: profileData?.region || 'Main Campus',
                        userId: user.id
                    }
                });
            }

            return user;
        });

        res.status(201).json({ message: 'User and Profile created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
