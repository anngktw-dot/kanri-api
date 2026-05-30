import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

const prisma = new PrismaClient();
const demoUserEmail = 'admin@example.com';

const defaultStatuses = [
  { name: 'to do', position: 1 },
  { name: 'in progress', position: 2 },
  { name: 'done', position: 3 },
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
      passwordHash: hashPassword('password123'),
    },
  });
}
const todo = await prisma.status.findUnique({ where: { name: 'To Do' } });
const inProgress = await prisma.status.findUnique({ where: { name: 'InProgress' } });
const review = await prisma.status.findUnique({ where: { name: 'Review' } });
const done = await prisma.status.findUnique({ where: { name: 'Done' } });

if (todo && inProgress && review && done) {
  const rules = [
    { fromStatusId: todo.id, toStatusId: inProgress.id, allowedRole: null },
    { fromStatusId: inProgress.id, toStatusId: review.id, allowedRole: null },
    { fromStatusId: review.id, toStatusId: inProgress.id, allowedRole: null },
    { fromStatusId: review.id, toStatusId: done.id, allowedRole: 'admin' },
  ];

  console.log('creating transition rules...');
  for (const rule of rules) {
    const existingRule = await prisma.transitionRule.findFirst({
      where: {
        fromStatusId: rule.fromStatusId,
        toStatusId: rule.toStatusId,
      },
    });

    if (!existingRule) {
      await prisma.transitionRule.create({ data: rule });
    }
  }
  console.log('Transition rules created successfully!');
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
