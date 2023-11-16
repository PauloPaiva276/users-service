# Serviço de Utilizadores

Permite a criação de utilizadores, registando de forma encriptada os respetivos dados pessoais, criando dados de autenticação e pseudonimização.

## Operações

Link para o Apollo Studio Sandbox: http://127.0.0.1:8000/graphql

### Queries:

- getUserById(id: String!): User!

- getUsers: [UserList]!

### Mutações:

- createUser(user: UserInputData!): User!

- updateUser(userId: String!, user: UserInputData!): User!

- deleteUser(userId: String!): UserMessage!

### Tipos de Dados:

- input UserInputData {
  username: String!
  password: String!
  email: String!
  name: String!
  address: String!
  nif: Int!
  phone: String!
  organizationId: String!
  role: UserRole!
  }

- type User {
  id: String!
  username: String!
  email: String!
  name: String!
  address: String!
  nif: Int!
  phone: String!
  organizationId: String!
  role: UserRole!
  }

- type UserList {
  id: String!
  username: String!
  organizationId: String!
  role: UserRole!
  }

- type UserMessage {
  success: Boolean!
  message: String!
  }

- enum UserRole {
  ADMIN
  STAFF
  ORGANIZATION_OWNER
  ORGANIZATION_STAFF
  AGRICULTURAL_PRODUCER
  TECHNICIAN
  }

## Para criar o container:

$ docker compose up --build
