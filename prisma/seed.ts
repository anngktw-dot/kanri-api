import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

const prisma = new PrismaClient();
const demoUserEmail = 'admin@example.com';

const defaultStatuses = [
  { name: 'To Do', position: 1 },
  { name: 'InProgress', position: 2 },
  { name: 'Review', position: 3 },
  { name: 'Done', position: 4 },
];

async function main() {
  for (const status of defaultStatuses) {
    await prisma.status.upsert({
      where: { name: status.name },
      update: { position: status.position },
      create: status,
    });
  }

  await prisma.user.upsert({
    where: { email: demoUserEmail },
    update: {},
    create: {
      email: demoUserEmail,
      name: 'Admin',
      passwordHash: hashPassword('ChangeMe123'),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
