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
    { name: 'Statuses' },
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
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
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
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login succeeded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenPair' },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
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
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
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
    '/tasks/{id}/status': {
      patch: {
        tags: ['Tasks'],
        summary: 'Update task status',
        description:
          'Changes the status of a task after validating transition rules, limits, and user roles.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  statusId: { type: 'string' },
                },
                required: ['statusId'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status successfully updated',
          },
          '400': {
            description: 'Bad Request (e.g., TRANSITION_NOT_ALLOWED, LIMIT_EXCEEDED)',
          },
          '401': {
            description: 'Unauthorized',
          },
          '403': {
            description: 'Forbidden (ROLE_REQUIRED)',
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
    },
    '/tasks/{id}/available-transitions': {
      get: {
        tags: ['Tasks'],
        summary: 'Get available transitions',
        description:
          'Returns a list of allowed status transitions for a specific task based on rules and user context.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'List of available statuses',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      position: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
          '404': {
            description: 'Task not found',
          },
        },
      },
    },
    '/statuses': {
      get: {
        tags: ['Statuses'],
        summary: 'Get all statuses',
        description: 'Returns a list of all default task statuses sorted by position.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      position: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
  },
} as const;
