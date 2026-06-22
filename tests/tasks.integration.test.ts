import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from '../src/app.js';
import { createAccessToken } from '../src/auth/jwt.js';
import { hashPassword } from '../src/auth/password.js';
import { prisma } from '../src/db.js';

const testPrefix = 'tasks-api-test';
const authorEmail = `${testPrefix}-author@example.com`;
const assigneeEmail = `${testPrefix}-assignee@example.com`;
const outsiderEmail = `${testPrefix}-outsider@example.com`;

type TestUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type JsonResponse = {
  status: number;
  body: unknown;
};

let server: Server;
let baseUrl: string;
let author: TestUser;
let assignee: TestUser;
let outsider: TestUser;
let authorToken: string;
let outsiderToken: string;
let workspaceId: string;

function jsonRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

async function requestJson(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

async function seedStatus(name: string, position: number): Promise<void> {
  await prisma.status.upsert({
    where: { name },
    update: { position },
    create: { name, position },
  });
}

async function createTask(title: string, statusName = 'to do') {
  const status = await prisma.status.findUniqueOrThrow({
    where: { name: statusName },
    select: { id: true },
  });

  return prisma.task.create({
    data: {
      workspaceId,
      statusId: status.id,
      reporterId: author.id,
      assigneeId: assignee.id,
      title,
    },
  });
}

void describe('tasks API integration', () => {
  before(async () => {
    await prisma.task.deleteMany({
      where: { title: { startsWith: testPrefix } },
    });
    await prisma.workspaceMember.deleteMany({
      where: {
        user: {
          email: { in: [authorEmail, assigneeEmail, outsiderEmail] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [authorEmail, assigneeEmail, outsiderEmail] } },
    });

    await seedStatus('to do', 1);
    await seedStatus('in progress', 2);
    await seedStatus('review', 3);
    await seedStatus('done', 4);

    author = await prisma.user.create({
      data: {
        email: authorEmail,
        name: 'Task Author',
        passwordHash: hashPassword('ChangeMe123'),
      },
    });
    assignee = await prisma.user.create({
      data: {
        email: assigneeEmail,
        name: 'Task Assignee',
        passwordHash: hashPassword('ChangeMe123'),
      },
    });
    outsider = await prisma.user.create({
      data: {
        email: outsiderEmail,
        name: 'Task Outsider',
        passwordHash: hashPassword('ChangeMe123'),
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: `${testPrefix} workspace`,
        members: {
          create: [
            { userId: author.id, role: 'admin' },
            { userId: outsider.id, role: 'member' },
          ],
        },
      },
      select: { id: true },
    });

    workspaceId = workspace.id;
    authorToken = createAccessToken(author).accessToken;
    outsiderToken = createAccessToken(outsider).accessToken;

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo | null;
        if (!address) {
          throw new Error('Test server did not expose an address');
        }

        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    await prisma.workspace.deleteMany({
      where: { id: workspaceId },
    });
    await prisma.task.deleteMany({
      where: { title: { startsWith: testPrefix } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [authorEmail, assigneeEmail, outsiderEmail] } },
    });
    await prisma.$disconnect();
  });

  void it('creates a task with To Do status and returns it without redirect', async () => {
    const response = await requestJson('/tasks', {
      method: 'POST',
      token: authorToken,
      body: {
        title: `${testPrefix} create`,
        description: 'Created from API',
        assignee: assignee.email,
        priority: 'high',
        deadline: '2026-06-01T10:00:00.000Z',
      },
    });

    assert.equal(response.status, 201);
    const task = jsonRecord(jsonRecord(response.body).task);

    assert.equal(task.title, `${testPrefix} create`);
    assert.equal(task.description, 'Created from API');
    assert.equal(task.status, 'To Do');
    assert.equal(task.priority, 'high');
    assert.equal(task.deadline, '2026-06-01T10:00:00.000Z');
    assert.equal(jsonRecord(task.assignee).email, assignee.email);
  });

  void it('validates required fields and rejects immediate Done status', async () => {
    const missingTitle = await requestJson('/tasks', {
      method: 'POST',
      token: authorToken,
      body: {
        title: '   ',
        assignee: assignee.email,
      },
    });
    const doneOnCreate = await requestJson('/tasks', {
      method: 'POST',
      token: authorToken,
      body: {
        title: `${testPrefix} done immediately`,
        assignee: assignee.email,
        status: 'Done',
      },
    });

    assert.equal(missingTitle.status, 400);
    assert.equal(doneOnCreate.status, 400);
  });

  void it('lists tasks with optional status and assignee filters', async () => {
    await createTask(`${testPrefix} list todo`, 'to do');
    await createTask(`${testPrefix} list review`, 'review');

    const all = await requestJson('/tasks', { token: authorToken });
    const byStatus = await requestJson('/tasks?status=Review', { token: authorToken });
    const byAssignee = await requestJson(`/tasks?assignee=${assignee.email}`, {
      token: authorToken,
    });

    assert.equal(all.status, 200);
    assert.equal(byStatus.status, 200);
    assert.equal(byAssignee.status, 200);

    const statusTasks = jsonRecord(byStatus.body).tasks as Record<string, unknown>[];
    const assigneeTasks = jsonRecord(byAssignee.body).tasks as Record<string, unknown>[];

    assert.ok(statusTasks.length >= 1);
    assert.ok(statusTasks.every((task) => task.status === 'Review'));
    assert.ok(assigneeTasks.every((task) => jsonRecord(task.assignee).email === assignee.email));
  });

  void it('returns details and updates editable task fields', async () => {
    const created = await createTask(`${testPrefix} detail`, 'review');

    const details = await requestJson(`/tasks/${created.id}`, { token: authorToken });
    const updated = await requestJson(`/tasks/${created.id}`, {
      method: 'PATCH',
      token: authorToken,
      body: {
        title: `${testPrefix} updated`,
        description: 'Updated description',
        status: 'Done',
        assigneeId: assignee.id,
        priority: 'low',
        deadline: '2026-06-02T12:00:00.000Z',
      },
    });

    assert.equal(details.status, 200);
    assert.equal(updated.status, 200);

    const task = jsonRecord(jsonRecord(updated.body).task);

    assert.equal(task.title, `${testPrefix} updated`);
    assert.equal(task.description, 'Updated description');
    assert.equal(task.status, 'Done');
    assert.equal(task.priority, 'low');
    assert.equal(task.deadline, '2026-06-02T12:00:00.000Z');
  });

  void it('blocks Done transition unless the task is already in Review', async () => {
    const created = await createTask(`${testPrefix} no direct done`, 'to do');

    const response = await requestJson(`/tasks/${created.id}`, {
      method: 'PATCH',
      token: authorToken,
      body: { status: 'Done' },
    });

    assert.equal(response.status, 400);
  });

  void it('blocks assigning more than 3 active tasks to one user', async () => {
    await prisma.task.deleteMany({
      where: {
        assigneeId: assignee.id,
        status: { name: { not: 'done', mode: 'insensitive' } },
      },
    });

    await createTask(`${testPrefix} active 1`);
    await createTask(`${testPrefix} active 2`);
    await createTask(`${testPrefix} active 3`);
    const doneTask = await createTask(`${testPrefix} active from done`, 'done');

    const createResponse = await requestJson('/tasks', {
      method: 'POST',
      token: authorToken,
      body: {
        title: `${testPrefix} active 4`,
        assignee: assignee.email,
      },
    });
    const updateResponse = await requestJson(`/tasks/${doneTask.id}`, {
      method: 'PATCH',
      token: authorToken,
      body: { status: 'To Do' },
    });

    assert.equal(createResponse.status, 400);
    assert.equal(updateResponse.status, 400);
  });

  void it('allows only workspace admins or the task author to delete a task', async () => {
    const blockedTask = await createTask(`${testPrefix} delete blocked`);
    const blocked = await requestJson(`/tasks/${blockedTask.id}`, {
      method: 'DELETE',
      token: outsiderToken,
    });

    const deletableTask = await createTask(`${testPrefix} delete allowed`);
    const deleted = await requestJson(`/tasks/${deletableTask.id}`, {
      method: 'DELETE',
      token: authorToken,
    });
    const exists = await prisma.task.findUnique({
      where: { id: deletableTask.id },
      select: { id: true },
    });

    assert.equal(blocked.status, 403);
    assert.equal(deleted.status, 200);
    assert.equal(exists, null);
  });

  void it('creates, lists, and permission-checks task comments', async () => {
    const task = await createTask(`${testPrefix} comments`);

    const created = await requestJson(`/tasks/${task.id}/comments`, {
      method: 'POST',
      token: authorToken,
      body: { body: 'First API comment' },
    });

    assert.equal(created.status, 201);
    const createdComment = jsonRecord(jsonRecord(created.body).comment);
    assert.equal(createdComment.taskId, task.id);
    assert.equal(createdComment.body, 'First API comment');
    assert.equal(jsonRecord(createdComment.author).email, author.email);

    await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: outsider.id,
        body: 'Older seeded comment',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const newerComment = await prisma.comment.create({
      data: {
        taskId: task.id,
        authorId: outsider.id,
        body: 'Newer seeded comment',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    });

    const listed = await requestJson(`/tasks/${task.id}/comments`, { token: authorToken });
    assert.equal(listed.status, 200);
    const comments = jsonRecord(listed.body).comments as Record<string, unknown>[];
    const seededComments = comments.filter((comment) =>
      String(comment.body).includes('seeded comment'),
    );
    assert.deepEqual(
      seededComments.map((comment) => comment.body),
      ['Older seeded comment', 'Newer seeded comment'],
    );

    const blocked = await requestJson(`/comments/${createdComment.id}`, {
      method: 'DELETE',
      token: outsiderToken,
    });
    const authorDeleted = await requestJson(`/comments/${createdComment.id}`, {
      method: 'DELETE',
      token: authorToken,
    });
    const adminDeleted = await requestJson(`/comments/${newerComment.id}`, {
      method: 'DELETE',
      token: authorToken,
    });

    assert.equal(blocked.status, 403);
    assert.equal(authorDeleted.status, 200);
    assert.equal(adminDeleted.status, 200);
  });
});
