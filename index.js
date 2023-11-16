const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const typeDefs = require("./graphql/schema");
const resolvers = require("./graphql/resolvers");
const authDirective = require("./graphql/directives");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { authDirectiveTypeDefs, authDirectiveTransformer } = authDirective();

const app = express();
const PORT = process.env.PORT || 8000;

async function startServer() {
  const usersDBClient = require("./databases/users-db");
  const pseudonymsDBClient = require("./databases/pseudonyms-db");
  const authDBClient = require("./databases/auth-db");
  await usersDBClient.connect();
  await pseudonymsDBClient.connect();
  await authDBClient.connect();
  try {
    const schema = makeExecutableSchema({
      typeDefs: [typeDefs, authDirectiveTypeDefs],
      resolvers,
    });
    const transformedSchema = authDirectiveTransformer(schema);
    const server = new ApolloServer({
      schema: transformedSchema,
      context: async ({ req }) => {
        return { usersDBClient, pseudonymsDBClient, authDBClient };
      },
      introspection: process.env.NODE_ENV !== "production",
      playground: process.env.NODE_ENV !== "production",
    });

    await server.start();

    server.applyMiddleware({ app, path: "/graphql" });

    app.listen({ port: PORT }, () => {
      console.log(
        `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
      );
    });
  } catch (error) {
    console.error("Error starting server:", error.message);
  }
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  process.exit(0);
});

app.get("/health", (req, res) => res.send("OK"));
