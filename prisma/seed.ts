import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
