const { gql } = require("apollo-server-express");

const typeDefs = gql`
  type Query {
    getUserById(id: String!): User!
    getUsers: [UserList]!
  }

  type Mutation {
    createUser(user: UserInputData!): User!
    updateUser(userId: String!, user: UserInputData!): User!
    deleteUser(userId: String!): UserMessage!
  }

  input UserInputData {
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

  type User {
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

  type UserList {
    id: String!
    username: String!
    organizationId: String!
    role: UserRole!
  }

  type UserMessage {
    success: Boolean!
    message: String!
  }

  enum UserRole {
    ADMIN
    STAFF
    ORGANIZATION_OWNER
    ORGANIZATION_STAFF
    AGRICULTURAL_PRODUCER
    TECHNICIAN
  }
`;

module.exports = typeDefs;
