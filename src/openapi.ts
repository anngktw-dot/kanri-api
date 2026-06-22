export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Kanri API',
    version: '1.0.0',
    description: 'Kanri task management API with JWT auth, refresh tokens, and PostgreSQL.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Tasks' },
    { name: 'Comments' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'name', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TokenPair: {
        type: 'object',
        required: [
          'accessToken',
          'tokenType',
          'expiresIn',
          'refreshToken',
          'refreshExpiresIn',
          'user',
        ],
        properties: {
          accessToken: { type: 'string' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', example: 900 },
          refreshToken: { type: 'string' },
          refreshExpiresIn: { type: 'integer', example: 604800 },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      Task: {
        type: 'object',
        required: ['id', 'title', 'description', 'status', 'assignee', 'deadline', 'priority'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', example: 'To Do' },
          assignee: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string', nullable: true },
            },
          },
          reporter: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string', nullable: true },
            },
          },
          deadline: { type: 'string', format: 'date-time', nullable: true },
          priority: { type: 'string', example: 'medium' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        required: ['id', 'taskId', 'body', 'author', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          taskId: { type: 'string', format: 'uuid' },
          body: { type: 'string' },
          author: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              name: { type: 'string', nullable: true },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        tags: ['System'],
        summary: 'API metadata',
        responses: {
          '200': {
            description: 'API is running',
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': { description: 'Server and database are healthy' },
          '503': { description: 'Database is unavailable' },
        },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['System'],
        summary: 'OpenAPI specification',
        responses: {
          '200': { description: 'OpenAPI JSON document' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  captchaToken: {
                    type: 'string',
                    description: 'Token generated by CAPTCHA widget (optional for local dev)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenPair' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '409': { description: 'Email already exists' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                // Вказуємо, що email і password обов'язкові
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    example: 'supersecret123',
                  },
                  captchaToken: {
                    type: 'string',
                    description: 'Token generated by CAPTCHA widget',
                    example: 'string',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Login succeeded. Tokens are set in httpOnly cookies.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Logged in successfully' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Invalid credentials' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue a new access token',
        //requestBody deleted
        responses: {
          '200': {
            description: 'Token refreshed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenPair' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the current access token and optional refresh token',
        security: [{ bearerAuth: [] }],
        //request body deleted
        responses: {
          '204': { description: 'Logged out' },
          '401': { description: 'Invalid or missing access token' },
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid or missing access token' },
        },
      },
    },
    '/tasks': {
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'assignee'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  assignee: { type: 'string', description: 'User id or email' },
                  assigneeId: { type: 'string', format: 'uuid' },
                  deadline: { type: 'string', format: 'date-time' },
                  priority: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Task created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['task'],
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request or active task limit reached' },
          '401': { description: 'Invalid or missing access token' },
          '404': { description: 'Assignee not found' },
        },
      },
      get: {
        tags: ['Tasks'],
        summary: 'List tasks',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'assignee',
            in: 'query',
            schema: { type: 'string' },
            description: 'User id or email',
          },
        ],
        responses: {
          '200': {
            description: 'Task list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tasks'],
                  properties: {
                    tasks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Task' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid or missing access token' },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get task details',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Task details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['task'],
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid or missing access token' },
          '404': { description: 'Task not found' },
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  status: { type: 'string', example: 'Review' },
                  assignee: { type: 'string', description: 'User id or email' },
                  assigneeId: { type: 'string', format: 'uuid' },
                  deadline: { type: 'string', format: 'date-time', nullable: true },
                  priority: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated task',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['task'],
                  properties: {
                    task: { $ref: '#/components/schemas/Task' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request or invalid status transition' },
          '401': { description: 'Invalid or missing access token' },
          '404': { description: 'Task, assignee, or status not found' },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Task deleted' },
          '401': { description: 'Invalid or missing access token' },
          '403': { description: 'Only administrators or task authors can delete' },
          '404': { description: 'Task not found' },
        },
      },
    },
    '/tasks/{id}/comments': {
      post: {
        tags: ['Comments'],
        summary: 'Create a task comment',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  body: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comment created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['comment'],
                  properties: {
                    comment: { $ref: '#/components/schemas/Comment' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Invalid or missing access token' },
          '404': { description: 'Task not found' },
        },
      },
      get: {
        tags: ['Comments'],
        summary: 'List task comments',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Task comments ordered from oldest to newest',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['comments'],
                  properties: {
                    comments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Comment' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid or missing access token' },
          '404': { description: 'Task not found' },
        },
      },
    },
    '/comments/{id}': {
      delete: {
        tags: ['Comments'],
        summary: 'Delete a comment',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Comment deleted' },
          '401': { description: 'Invalid or missing access token' },
          '403': { description: 'Only administrators or comment authors can delete' },
          '404': { description: 'Comment not found' },
        },
      },
    },
  },
} as const;
